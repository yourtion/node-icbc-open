import crypto from "crypto";
import https from "https";
import { stringify } from "querystring";

const HOST = "https://gw.open.icbc.com.cn/api";
const IV = Buffer.alloc(16);

/** AES 解密 */
function aesDecrypt(key: Buffer, iv: Buffer, crypted: string) {
  const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
  const decoded = decipher.update(crypted, "base64", "utf8") + decipher.final("utf8");
  return decoded;
}

function lp(n: any, c: number) {
  let res = String(n);
  while (res.length < c) {
    res = "0" + res;
  }
  return res;
}

function dateTime(d = new Date()) {
  return (
    `${d.getFullYear()}-${lp(d.getMonth() + 1, 2)}-${lp(d.getDate(), 2)} ` +
    `${lp(d.getHours(), 2)}:${lp(d.getMinutes(), 2)}:${lp(d.getSeconds(), 2)}`
  );
}

/** sha256withrsa2048 */
function sha256(str: string) {
  return crypto
    .createHash("sha256")
    .update(str)
    .digest();
}

/** RSA 签名（sha1WithRSAEncryption） */
function rsaSign(en: string, key: string) {
  return crypto
    .createSign("sha1WithRSAEncryption")
    .update(en)
    .sign(key, "base64");
}

function verifySign(data: Buffer, sign: string, pubkey: string) {
  return crypto
    .createVerify("RSA-SHA1")
    .update(data)
    .verify(pubkey, sign, "base64");
}

function genReqId() {
  return (
    Date.now().toString(16) +
    Math.random()
      .toString(36)
      .substring(2)
  );
}

export interface IOption {
  /** 工行 APP 编号 */
  appId: string;
  /** 工行商户档案编号 */
  mertId: string;
  /** 用户解密密钥（Base64） */
  aesKey: string;
  /** 工行服务器公钥 */
  icbcPublicKey?: string;
  /** 自己的私钥 */
  privateKey: string;
}

export interface IUser {
  /** 解密后原始数据 */
  origin: Record<string, any>;
  /** 用户唯一标识 */
  custId: string;
  /** 手机号 */
  phone: string;
  /** 是否为新用户 */
  isNewUser: boolean;
  /** 手机设备号 */
  deviceId: string;
}

export interface ISendEcouponRes {
  /** 返回码，交易成功返回0，其余为错误码 */
  return_code: string;
  /** 返回码说明 */
  return_msg: string;
  /** 消息号 */
  msg_id: string;
  /** 返回值 */
  result: string;
  /** 错误编号 */
  error_code: string;
  /** 错误信息 */
  error_msg: string;
  /** 电子券编号 */
  ec_id: string;
  /** 活动编号 */
  act_id: string;
  /** 电子券活动名称 */
  ec_act_name: string;
  /** 电子券面额 */
  ec_face_value: string;
  /** 电子券状态 */
  ec_status: string;
  /** 电子券生效日期 */
  effect_begin_date: string;
  /** 电子券结束日期 */
  effect_end_date: string;
}

export default class ICBC {
  private aesKey: Buffer;
  private timeout = 5000;
  private api = HOST;
  private icbcPublicKey: string;
  private privateKey: string;
  private appId: string;
  private mertId: string;

  constructor(opt: IOption) {
    this.aesKey = Buffer.from(opt.aesKey, "base64");
    this.icbcPublicKey = opt.icbcPublicKey || "";
    this.privateKey = opt.privateKey;
    this.appId = opt.appId;
    this.mertId = opt.mertId;
  }

  request(method: "GET" | "POST", path: string, body?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const options = {
        timeout: this.timeout,
        method,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      };
      const req = https.request(this.api + path, options, res => {
        if (res.statusCode !== 200) return reject({ code: res.statusCode });
        const buffers: any[] = [];
        res.on("data", chunk => buffers.push(chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(Buffer.concat(buffers).toString("utf8"));
            console.log(json);
            if (json.response_biz_content) return resolve(json.response_biz_content);
            resolve(json);
          } catch (err) {
            return reject(err);
          }
        });
      });
      req.on("error", err => reject(err));
      if (body) {
        req.end(typeof body === "object" ? stringify(body) : body);
      } else {
        req.end();
      }
    });
  }

  sign(url: string, params: Record<string, any>) {
    const res = {
      app_id: this.appId,
      msg_id: genReqId(),
      timestamp: dateTime(),
      format: "json",
      charset: "UTF-8",
      sign_type: "RSA",
      biz_content: JSON.stringify(params),
    } as any;
    const keys = Object.keys(res).sort();
    const signArr: string[] = [];
    for (const k of keys) {
      signArr.push(`${k}=${res[k]}`);
    }
    const signStr = signArr.join("&");
    res.sign = rsaSign(`/api${url}?${signStr}`, this.privateKey);
    console.log(res);
    return res;
  }

  getUserInfo(data: string): IUser | undefined {
    const dec = aesDecrypt(this.aesKey, IV, data.replace(/\s/g, "+"));
    const jsonString = Buffer.from(dec, "base64")
      .toString()
      .replace(/'/g, '"');
    try {
      const user = JSON.parse(jsonString);
      return {
        origin: user,
        custId: user.cust_id,
        phone: String(user.phone),
        isNewUser: user.isNewUser === "0",
        deviceId: user.device_id,
      };
    } catch (err) {
      console.error("getUserInfo: ", { data, jsonString });
    }
    return;
  }

  protected sendEcoupon(params: Record<string, any>): Promise<ISendEcouponRes> {
    const url = "/ecoupon/send/V1";
    const res = this.sign(url, params);
    return this.request("POST", url, res);
  }

  /**
   * 通过 UID 第三方电子券发券
   *
   * @param actId 电子券活动编号
   * @param serNo 流水号
   * @param uid 客户统一通行证号
   */
  sendEcouponByUid(actId: string, serNo: number, uid: string) {
    return this.sendEcoupon({ mert_id: this.mertId, ec_act_id: actId, user_id: uid, ser_no: serNo });
  }

  /**
   * 通过手机号第三方电子券发券
   *
   * @param actId 电子券活动编号
   * @param serNo 流水号
   * @param phone 客户手机号
   */
  sendEcouponByMobile(actId: string, serNo: number, phone: string) {
    return this.sendEcoupon({ mert_id: this.mertId, ec_act_id: actId, user_mobile_no: phone, ser_no: serNo });
  }

  protected queryEcoupon(params: Record<string, any>): Promise<ISendEcouponRes> {
    const url = "/ecoupon/send/query/V1";
    const res = this.sign(url, params);
    return this.request("POST", url, res);
  }

  /**
   * 通过 UID 发券查询
   *
   * @param actId 电子券活动编号
   * @param serNo 流水号
   * @param uid 客户统一通行证号
   */
  queryEcouponByUid(actId: string, serNo: number, uid: string) {
    return this.queryEcoupon({ mert_id: this.mertId, ec_act_id: actId, user_id: uid, ser_no: serNo });
  }

  /**
   * 通过手机号发券查询
   *
   * @param actId 电子券活动编号
   * @param serNo 流水号
   * @param phone 客户手机号
   */
  queryEcouponByMobile(actId: string, serNo: number, phone: string) {
    return this.queryEcoupon({ mert_id: this.mertId, ec_act_id: actId, user_mobile_no: phone, ser_no: serNo });
  }
}
