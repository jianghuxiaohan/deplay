#!/usr/bin/env node
const fs = require('fs');
// 说明此文件为node的可执行脚本文件
const path = require('path');
const ora = require('ora');
const zipper = require('zip-local');
const shell = require('shelljs');
const NodeSSH = require('node-ssh').NodeSSH;
const { warning, success, defaultLog, errorLog } = require('./utils');
const crypto = require('crypto');
const { default: axios } = require('axios');
let SSH = new NodeSSH();
const { cd, exec } = shell;
const { resolve } = path;
const { sync } = zipper;
const { existsSync, unlinkSync } = fs;
const distZipPath = resolve(process.cwd(), './dist.zip');

// 打包 npm run build 或yarn build
const compileDist = async CURCONFIG => {
  // 进入本地文件夹
  cd(process.cwd(), './');
  exec(CURCONFIG.SCRIPT || 'npm run build');
  success('打包完成');
};

// 获取项目的最新提交项目负责人
const getAuthor = () => {
  // 进入本地文件夹
  cd(process.cwd(), './');
  const text = exec('git log');
  return JSON.parse(JSON.stringify(text)).split('\n')[1].slice(8);
};

// ******压缩dist文件******

const zipDist = async CURCONFIG => {
  try {
    if (existsSync(distZipPath)) {
      defaultLog('dist.zip已经存在，即将删除压缩包');
      unlinkSync(distZipPath);
    } else {
      defaultLog('即将开始压缩zip文件');
    }
    let spinner = ora('文件开始压缩').start();

    sync
      .zip(path.resolve(process.cwd(), CURCONFIG.DIST || './dist'))
      .compress()
      .save(distZipPath);
    spinner.succeed('文件压缩成功');
  } catch (error) {
    errorLog(error);
    errorLog('压缩dist文件失败');
  }
};

// ********执行清空线上文件夹指令**********
const runCommond = async (commond, CONFIG) => {
  const result = await SSH.exec(commond, []);
  console.log(warning(result));
};
// ********* 执行清空线上文件夹指令 *********
const runBeforeCommand = async CONFIG => {
  let spinner = ora('正在删除服务器文件').start();
  await runCommond(`rm -rf ${CONFIG.PATH}/dist.zip`);
  await runCommond(`rm -rf ${CONFIG.PATH}/dist`);
  spinner.succeed('删除服务器文件成功');
};
const handleTIme = time => {
  const date = new Date(time);
  const year = date.getFullYear();
  const mouth = (date.getMonth() + 1).toString().padStart(2, 0);
  const day = date.getDate().toString().padStart(2, 0);
  const hours = date.getHours().toString().padStart(2, 0);
  const min = date.getMinutes().toString().padStart(2, 0);
  const second = date.getSeconds().toString().padStart(2, 0);

  return `${year}-${mouth}-${day} ${hours}:${min}:${second}`;
};

// 钉钉机器人
const sendDingTalkMsg = async (CONFIG, serverName) => {
  // 构建请求参数
  if (!CONFIG.DingDing || !CONFIG.DingDing.secret || !CONFIG.DingDing.hook) {
    warning(
      `如果想使用钉钉,请配置(name、hook、secret),分别代表项目名称,机器人推送地址,密钥`
    );
    return false;
  }
  const time = Date.now();

  const secret = CONFIG.DingDing.secret;
  let url = CONFIG.DingDing.hook;
  console.log('secret', secret, url);
  const data = {
    msgtype: 'markdown',
    markdown: {
      title: CONFIG.DingDing.name,
      text: `## project: ${
        CONFIG.DingDing.name
      } \n ## env: ${serverName} \n ## Author:  ${getAuthor()} \n time: ${handleTIme(
        time
      )}`, //聊天内容
    },
    at: {
      atMobiles: CONFIG.DingDing.user,
      isAtAll: CONFIG.DingDing.isAll,
    },
  };
  const stringToSign = time + '\n' + secret;
  const base = crypto
    .createHmac('sha256', secret)
    .update(stringToSign)
    .digest('base64');
  const sign = encodeURIComponent(base); //签名
  url = url + `&timestamp=${time}&sign=${sign}`;
  const postData = {
    ...data,
    time,
    sign,
  };
  const headers = {
    'Content-Type': 'application/json',
  };
  try {
    const res = await axios.post(url, JSON.stringify(postData), { headers });
    success('钉钉消息发送成功');
  } catch (error) {
    error(`钉钉消息发送失败${error}`);
  }
};

// 通过ssh上传文件服务器
const uploadZipBySSH = async (CONFIG, servername, GCONFIG) => {
  // 上传文件
  let spinner = ora('准备上传文件').start();
  try {
    await SSH.putFile(distZipPath, CONFIG.PATH + '/dist.zip');
    // await SSH.putFile(distZipPath, '/root/dist.zip');
    spinner.succeed('文件上传服务器成功');
    let spinner1 = ora('完成上传，开始解压').start();
    await runCommond(`unzip ${CONFIG.PATH}"/dist.zip" -d ${CONFIG.PATH}/dist`);
    spinner1.succeed('文件解压成功');
    await sendDingTalkMsg(GCONFIG, servername);
    success(`${CONFIG.NAME}部署完成`);
    process.exit(0);
  } catch (err) {
    errorLog(err);
    errorLog('上传失败');
  }
};

const getServerConfig = (serverName, serverConfig) => {
  return serverConfig.find(item => {
    return item.NAME == serverName;
  });
};

// 连接ssh
const connectSSH = async (CURCONFIG, CONFIG, servername) => {
  defaultLog(`尝试连接服务：${CURCONFIG.SERVER_PATH}`);
  defaultLog(`密钥路径${CONFIG.PRIVATE_KEY}`);
  let spinner = ora('正在连接').start();
  try {
    SSH.connect({
      host: CURCONFIG.SERVER_PATH,
      username: CURCONFIG.SSH_USER,
      password: CURCONFIG.SSH_KEY,
      privateKey: Buffer.from(CONFIG.PRIVATE_KEY).toString() ?? '',
      port: CURCONFIG.PORT || 22,
    }).then(async () => {
      // exec(`sh ${connect} ${CURCONFIG.SERVER_PATH} ${CURCONFIG.PATH}`);
      spinner.succeed('服务器连接成功');
      await runBeforeCommand(CURCONFIG);
      await uploadZipBySSH(CURCONFIG, servername, CONFIG);
    });
  } catch (err) {
    errorLog(err);
    errorLog('ssh连接失败');
  }
};

async function runTask(hasBuild, serverName, serverConfig, CONFIG) {
  const CURCONFIG = getServerConfig(serverName.server_name, serverConfig);
  if (hasBuild) {
    await compileDist(CURCONFIG);
  }
  await zipDist(CURCONFIG);
  await connectSSH(CURCONFIG, CONFIG, serverName.server_name);
}

module.exports = runTask;
