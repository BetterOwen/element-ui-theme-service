const fs = require("fs/promises");
const path = require("path");
const sass = require("sass");

const gulp = require("gulp");
const gulpSass = require("gulp-sass")(require("sass"));
const gulpAutoprefixer = require('gulp-autoprefixer')
const gulpRename = require("gulp-rename");

const util = {
  randomStr() {
    return Math.random().toString(16).slice(2);
  }
}

async function hasInstall(version) {
  const packageJson = await fs.readFile(path.join(__dirname, "package.json"));
  const { dependencies } = JSON.parse(packageJson);
  const versions = Object.keys(dependencies);

  return versions.includes(version);
}

async function versinInstall(version) {
  // npm install -S 2.15.8@npm:element-theme-chalk@2.15.8
}

function resolveVersionPath(filepath, version) {
  let pathStr = path.resolve(__dirname, `./node_modules/${version}/src/`, filepath);
  return pathStr.replace(/\\/g, "/");
}

function tempPath(filepath) {
  return path.resolve(__dirname, "../var", filepath);
}

async function getVars(version) {
  const filepath = resolveVersionPath("common/var.scss", version);
  return fs.readFile(filepath, "utf-8");
}

async function genVars(data, version) {
  const vars = Object.assign({}, data.global, data.local);

  const lines = [];

  for (let key of Object.keys(vars)) {
    let value = vars[key];
    if (value.startsWith("$")) {
      value = await getGlobalVarsValue(value, version);
    }

    lines.push(`${key}: ${value};`)
  }

  lines.push(`@import "${resolveVersionPath("index.scss", version)}";`)

  const result = lines.join("\n");
  const filePath = tempPath(`index_${util.randomStr()}.scss`);
  await fs.writeFile(filePath, result);

  return filePath;
}

async function parseVars(version) {
  let context = await getVars(version);
  let lines = context.split(/\n/);
  let globals = ["color", "typography", "border"];
  let result = [];
  let curItem = {};
  lines.forEach((line, index) => {
    const nextLine = lines[index + 1] || "";
    // 一个类目
    if (line.startsWith("/*") && nextLine.startsWith("---")) {
      let name = line.replace("/*", "").trim().toLowerCase();
      // 首字符小写
      // name = name.charAt(0).toUpperCase() + name.slice(1),

      curItem = {
        name,
        config: []
      };
    }

    if (line.startsWith("///")) {
      const rule = line.replace("///", "").trim();
      const [type, skipAutoTranslation, category, order] = rule.split("|");
      const configItem = {
        order: +order,
        category,
        skipAutoTranslation,
        type
      };
      if (globals.includes(curItem.name)) {
        configItem.name = curItem.name;
      }
      if (nextLine.startsWith("$")) {
        const nextLineKV = nextLine.replace("!default;", "").trim();
        const [key, value] = nextLineKV.split(":");
        configItem.key = key.trim();
        configItem.value = value.trim();
      }
      // 排除结果中curItem.config为空的项
      if (!curItem.config.length) {
        result.push(curItem);
      }

      curItem.config.push(configItem);
    }
  });

  return result;
}

let globals = ["color", "typography", "border"];
async function getGlobalVarsValue(key, version) {
  const values = await parseVars(version);
  const globalItems = values.reduce((acc, cur) => {
    if (globals.includes(cur.name)) {
      return acc.concat(cur.config);
    }
    else {
      return acc;
    }
  }, [])

  const item = globalItems.find((t) => t.key === key);
  if (!item) {
    throw new Error("变量不存在该变量:" + key)
  }
  return item.value;
}


async function build(data, version) {
  const varsfilepath = await genVars(data, version);

  const randomDestDir = "custom-theme-" + util.randomStr();
  await new Promise((resolve, reject) => {
    gulp.src(varsfilepath)
      .pipe(gulpSass.sync({ outputStyle: 'compressed' }))
      .pipe(gulpAutoprefixer({
        overrideBrowserslist: [`> 1%`, `last 2 versions`, `not dead`],
        cascade: false
      }))
      .pipe(gulpRename("index.css"))
      .pipe(
        gulp.dest(tempPath(randomDestDir + "/theme"))
      )
      .on("end", () => {
        resolve();
      })
      .on("error", (e) => {
        reject(e);
      });
  });

  await new Promise((resolve, reject) => {
    gulp.src(resolveVersionPath("fonts", version) + "/**")
      .pipe(
        gulp.dest(tempPath(randomDestDir + "/theme/fonts"))
      )
      .on("end", () => {
        resolve();
      })
  });

  await fs.writeFile(tempPath(randomDestDir + "/config.json"), JSON.stringify({
    global: data.global,
    local: data.local
  }));
  return tempPath(randomDestDir)
}

async function view(data, version) {
  const varsfilepath = await genVars(data, version);
  const ret = await sass.compileAsync(varsfilepath, { style: "compressed" });
  return ret.css;
}

module.exports = {
  parseVars,
  build,
  view
}
