const chalk = require("chalk");
const { red, blue, green, yellow } = chalk;
const errorLog = (error) => console.log(red(`=========>${error}`));
const defaultLog = (log) => console.log(blue(`=========>${log}`));
const success = (log) => console.log(green(`=========>${log}`));
const warning = (log) => console.log(yellow(`${log}`));

module.exports = {
  errorLog,
  defaultLog,
  success,
  warning,
};
