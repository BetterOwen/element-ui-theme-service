const express = require('express');
const archiver = require("archiver")
const router = express.Router();

const elementThemes = require("../element-ui-themes");

router.get('/getVariable', async function (req, res) {
  const query = req.query;
  const version = query?.version;
  const result = await elementThemes.parseVars(version);

  res.json(result)
});
router.post('/updateVariable', async function (req, res) {
  const query = req.query;
  const data = req.body;
  const version = query?.version;

  const download = data.download;
  if (!download) {
    const css = await elementThemes.view(data, version)
    res.send(css);
  }
  else {
    const dirpath = await elementThemes.build(data, version);

    const archive = archiver("zip");
    archive.directory(dirpath + "/", false);
    res.setHeader("Content-Disposition", `attachment;filename=custom.zip`);
    res.setHeader("Content-Type", `application/zip`);
    archive.pipe(res);
    archive.finalize();
  }
});

module.exports = router;