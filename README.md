[![NPM version][npm-image]][npm-url]
[![node version][node-image]][node-url]
[![npm download][download-image]][download-url]
[![npm license][license-image]][download-url]

[npm-image]: https://img.shields.io/npm/v/icbc-open.svg?style=flat-square
[npm-url]: https://npmjs.org/package/icbc-open
[node-image]: https://img.shields.io/badge/node.js-%3E=4.0-green.svg?style=flat-square
[node-url]: http://nodejs.org/download/
[download-image]: https://img.shields.io/npm/dm/icbc-open.svg?style=flat-square
[download-url]: https://npmjs.org/package/icbc-open
[license-image]: https://img.shields.io/npm/l/icbc-open.svg

# node-icbc-open

掌上生活开放平台（ https://open.cmbchina.com/Platform/ ） Node.js SDK

## 安装

```bash
npm install icbc-open --save
```

## 使用

```javascript
const ICBC = require("icbc-open");

const icbc = new ICBC({
  appId: "10000000000000",
  mertId: "00000000",
  aesKey: "xxxx", // base64 aseKey
  icbcPublicKey: "",
  privateKey: fs.readFileSync("prod.key").toString(),
});

// 登录获取用户信息
const userInfo = icbc.getUserInfo("xxxx"); // Base64 from APP

// 手机号发券
await icbc.sendEcouponByMobile("XXX", 1234566, "13800138000");
// 手机号发券查询
await icbc.queryEcouponByMobile("XXX", 1234566, "13800138000");
```
