#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const ora = require("ora");
const download = require("download-git-repo");
const { success, defaultLog, errorLog } = require("./utils");
const deployPath = path.join(process.cwd());
const deployConfigPath = `${deployPath}/deploy.config.js`;
const deployTem = "github:jianghuxiaohan/deploy-template";
const checkDeployExists = () => {
  if (fs.existsSync(deployConfigPath)) {
    defaultLog("根目录下已经存在deploy.config.js文件，请勿重新下载");
    process.exit(1);
  }
  downloadAndGenerate(deployTem);
};

const downloadAndGenerate = (templateURL) => {
  const spinner = ora("开始生成部署模板");
  spinner.start();
  download(templateURL, process.cwd(), { clone: false }, (err) => {
    if (err) {
      errorLog(err);
      process.exit(1);
    }
    spinner.stop();
    success("模板下载成功，模板位置：/deploy.config.js");
    defaultLog("请配置根目录下的deploy.config.js配置文件");
    console.log("注意：请删除不必要的环境配置");
    process.exit(0);
  });
};
module.exports = () => {
  checkDeployExists();
};
