'use strict';

module.exports = core;

const path = require('path');
const semver = require('semver');
const { homedir } = require('os')
const userHome = homedir();
const pathExists = require('path-exists').sync;
const { Command } = require('commander');
const rootCheck = require('root-check');
const colors = require('colors/safe');
const pkg = require('../package.json');
const log = require('@der-cli/log');
const exec = require('@der-cli/exec');
const {
  DEFAULT_CLI_HOME,
  DER_CLI_LOGO
} = require('./const');
const {
  Error_USER_HOME_NOT_EXISTS,
  Error_ROOT_USER,
  Error_NPM_VERSION,
  Error_UNKNOWN_CMD,
  Error_ALL_CMDS
} = require('./error');

const program = new Command();

let args;

async function core() {
  try {
    await prepare();
    registerCommand();
  } catch (e) {
    log.error(`${e}`);
    if (program.debug) {
      console.log(e);
    }
  }
}

// 1.准备阶段
async function prepare() {
  printLogo()
  checkPkgVersion();
  checkRoot();
  checkUserHome();
  checkEnv();
  await checkGlobalUpdate();
}

// 2.脚手架初始化: 注册命令
function registerCommand() {
  const options = program.opts();

  program
    .name(Object.keys(pkg.bin)[0]) // der
    .description(pkg.description)
    .usage('<command> [options]')
    .version(pkg.version)
    .option('-d, --debug', '是否开启调试模式', false)
    .option('-tp, --targetPath <targetPath>', '指定本地调试文件路径', '');

  program
    .command('init [projectName]')
    .description('初始化项目')
    .option('-f, --force', '强制初始化项目(Clear folder)')
    .action(exec) // 子进程 ☆

  program
    .command('go')
    .description('发布项目')
    .option('-rs, --refreshServer', '强制更新本地Git平台缓存', false)
    .option('-rt, --refreshToken', '强制更新本地Git Token缓存', false)
    .option('-ro, --refreshOwner', '强制更新Git Owner信息', false)
    .option('-re, --release', '发布Tag版本', false)
    .option('-f, --force', '强制更新所有缓存信息(TODO)', false)
    .action(exec)

  program
    .command('clean')
    .description('清空缓存文件')
    .option('-a, --all', '清空全部')
    .option('--dep', '清空依赖文件')
    .action(exec)


  // 开启debug模式
  program.on('option:debug', function () {
    if (options.debug) {
      process.env.DER_CLI_LOG_LEVEL = 'verbose';
    } else {
      process.env.DER_CLI_LOG_LEVEL = 'info';
    }
    log.level = process.env.DER_CLI_LOG_LEVEL;
    log.verbose('[core/cli] debug', 'You have turned on debugging.');
  });

  // 指定targetPath
  program.on('option:targetPath', function () {
    // 保存targetPath
    process.env.DER_CLI_TARGET_PATH = options.targetPath;
  });

  // 对未知命令监听
  program.on('command:*', function (obj) {
    // All CMDS
    const availableCommands = program.commands.map(cmd => cmd.name());
    log.warn(Error_UNKNOWN_CMD(obj[0]));
    if (availableCommands.length > 0) {
      log.warn(Error_ALL_CMDS(availableCommands));
    }
  });

  program.parse(process.argv);

  // der init/create/...
  if (program.args && program.args.length < 1) {
    // output help information without exiting
    program.outputHelp();
    console.log();
  }
}

// 1.0 der logo
function printLogo() {
  console.log(colors.cyan(DER_CLI_LOGO));
}

// 1.1 检查 @der-cli/core 版本号
function checkPkgVersion() {
  log.info('[core/cli]', `${pkg.name}@${pkg.version}`);
}

// 1.2 检查是否为root用户启动
function checkRoot() {
  rootCheck(Error_ROOT_USER());
}

// 1.3 检查用户主目录
function checkUserHome() {
  if (!userHome || !pathExists(userHome)) {
    Error_USER_HOME_NOT_EXISTS()
  }
}

// 1.4 检查环境变量
function checkEnv() {
  const dotenv = require('dotenv');
  // 检查本地是否存在 .env 文件
  const dotenvPath = path.resolve(userHome, '.env');

  if (pathExists(dotenvPath)) {
    dotenv.config({
      path: dotenvPath,
    });
  }
  createDefaultConfig();
  // log.verbose('环境变量', process.env.DER_CLI_HOME_PATH);
  // C:\Users\hostname\.der-cli
}

// 1.5 创建默认配置文件
function createDefaultConfig() {
  const cliConfig = {
    home: userHome,
  };
  if (process.env.DER_CLI_HOME) {
    cliConfig['cliHome'] = path.join(userHome, process.env.DER_CLI_HOME);
  } else {
    cliConfig['cliHome'] = path.join(userHome, DEFAULT_CLI_HOME);
  }
  process.env.DER_CLI_HOME_PATH = cliConfig.cliHome;
}

// 1.6 检查是否需要全局更新
async function checkGlobalUpdate() {
  // 获取当前信息
  const currentVersion = pkg.version;
  const npmName = pkg.name;
  // 获取 npm 所有版本号
  const { getNpmSemverVersion } = require('@der-cli/get-npm-info');
  const lastVersion = await getNpmSemverVersion(currentVersion, npmName);
  // 判断是否需要更新
  if (lastVersion && semver.gt(lastVersion, currentVersion)) {
    log.warn(Error_NPM_VERSION(npmName, currentVersion, lastVersion));
  }
  // else {
  //   log.info('cli', `当前版本为最新版: v${currentVersion}`);
  // }
}

// TODO
process.on('unhandleRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
  throw reason;
})

// 监听全局错误
process.on('uncaughtException', (err) => {
  log.error('uncaughtException', err);
  process.exit(1);
})