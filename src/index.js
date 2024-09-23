#!/usr/bin/env node
const inquirer = require("inquirer");
const { Command } = require("commander");
const packageJson = require("../package.json");
const runTask = require("../lib/deploy");
const program = new Command();
const fs = require("fs");
const { errorLog, defaultLog, success, warning } = require("../lib/utils");
const path = require("path");
const { existsSync } = fs;
const distZipPath = path.resolve(process.cwd(), "./dist.zip");

program
  .version(packageJson.version, "-v, --version")
  .command("init")
  .description("初始化部署相关配置")
  .action(() => {
    require("../lib/init")();
  });

program
  .version(packageJson.version)
  .command("push")
  .description("部署项目")
  .action(async () => {
    if (fs.existsSync(path.resolve(process.cwd(), "./deploy.config.js"))) {
      const CONFIG = require(path.resolve(process.cwd(), "./deploy.config.js"));
      const serverConfig = [...CONFIG().SERVER];
      const answers = await inquirer.prompt([
        {
          type: "confirm",
          name: "hasBuild",
          message: "是否需要打包",
        },
      ]);
      let hasBuild = answers.hasBuild ? true : !existsSync(distZipPath);
      const serverName = await inquirer.prompt([
        {
          type: "list",
          name: "server_name",
          message: "请选择部署的服务器",
          choices: serverConfig.map((item) => item.NAME),
        },
      ]);
      runTask(hasBuild, serverName, serverConfig, CONFIG());
    } else {
      defaultLog(`缺少部署相关的配置，请运行"h-deploy init"下载部署配置`);
    }
  });
program.parse(process.argv);
