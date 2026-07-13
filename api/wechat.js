const crypto = require('crypto');
const https = require('https');

// ─── 微信支付配置 ──────────────────────────────────
const WECHAT_CONFIG = {
  appId: process.env.WECHAT_APP_ID || '',
  mchId: process.env.WECHAT_MCH_ID || '',
  apiV3Key: process.env.WECHAT_API_V3_KEY || '',
  serialNo: process.env.WECHAT_SERIAL_NO || '',
  privateKey: (process.env.WECHAT_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  notifyUrl: process.env.WECHAT_NOTIFY_URL || 'https://accounting-quiz.onrender.com/api/payment/wechat/callback'
};

// ─── 签名工具 ──────────────────────────────────────
function sign(method, urlPath, timestamp, nonceStr, body) {
  const signStr = `${method}\n${urlPath}\n${timestamp}\n${nonceStr}\n${body}\n`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signStr);
  return signer.sign(WECHAT_CONFIG.privateKey, 'base64');
}

function getAuthorization(method, urlPath, body) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = crypto.randomBytes(16).toString('hex');
  const signature = sign(method, urlPath, timestamp, nonceStr, body);
  return {
    Authorization: `WECHATPAY2-SHA256-RSA2048 mchid="${WECHAT_CONFIG.mchId}",nonce_str="${nonceStr}",timestamp="${timestamp}",serial_no="${WECHAT_CONFIG.serialNo}",signature="${signature}"`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': 'accounting-quiz/1.0'
  };
}

// ─── HTTP 请求 ─────────────────────────────────────
function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const headers = getAuthorization(method, urlPath, bodyStr);
    const options = {
      hostname: 'api.mch.weixin.qq.com',
      path: urlPath,
      method,
      headers,
      timeout: 10000
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(result);
          } else {
            reject({ statusCode: res.statusCode, ...result });
          }
        } catch (e) {
          reject({ statusCode: res.statusCode, message: data });
        }
      });
    });
    req.on('error', e => reject(e));
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ─── 下单 Native 支付 ──────────────────────────────
async function createNativeOrder({ outTradeNo, description, amount, notifyUrl }) {
  const body = {
    appid: WECHAT_CONFIG.appId,
    mchid: WECHAT_CONFIG.mchId,
    description,
    out_trade_no: outTradeNo,
    notify_url: notifyUrl || WECHAT_CONFIG.notifyUrl,
    amount: {
      total: amount,  // 单位：分
      currency: 'CNY'
    }
  };
  return request('POST', '/v3/pay/transactions/native', body);
}

// ─── 查询订单状态 ──────────────────────────────────
async function queryOrder(outTradeNo) {
  const urlPath = `/v3/pay/transactions/out-trade-no/${outTradeNo}?mchid=${WECHAT_CONFIG.mchId}`;
  return request('GET', urlPath, null);
}

// ─── 验证回调签名 ──────────────────────────────────
function verifyNotification(headers, body) {
  const timestamp = headers['wechatpay-timestamp'];
  const nonce = headers['wechatpay-nonce'];
  const signature = headers['wechatpay-signature'];
  const serial = headers['wechatpay-serial'];

  if (!timestamp || !nonce || !signature) {
    return { valid: false, error: '缺少签名头' };
  }

  const signStr = `${timestamp}\n${nonce}\n${body}\n`;

  // 验证签名：使用微信平台证书的公钥
  // 注意：生产环境需要从微信获取平台证书，这里使用 Wechatpay-Serial 指定的证书
  try {
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(signStr);

    // 平台证书需要从微信获取并缓存，这里提供基础结构
    const platformCert = process.env.WECHAT_PLATFORM_CERT || '';
    const cert = platformCert.replace(/\\n/g, '\n');

    if (!cert) {
      // 开发环境：跳过签名验证
      console.warn('[WECHAT] 未配置平台证书，跳过签名验证');
      return { valid: true, devMode: true };
    }

    const valid = verifier.verify(cert, signature, 'base64');
    return { valid, serial };
  } catch (e) {
    console.error('[WECHAT] 签名验证异常:', e.message);
    return { valid: false, error: e.message };
  }
}

// ─── 解密回调资源 ──────────────────────────────────
function decryptResource(ciphertext, associatedData, nonce) {
  const key = WECHAT_CONFIG.apiV3Key;
  if (!key) {
    console.warn('[WECHAT] 未配置 APIv3 密钥，跳过解密');
    return null;
  }
  try {
    const authTag = Buffer.from(ciphertext, 'base64').slice(-16);
    const data = Buffer.from(ciphertext, 'base64').slice(0, -16);
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(key),
      Buffer.from(nonce, 'base64')
    );
    decipher.setAuthTag(authTag);
    decipher.setAAD(Buffer.from(associatedData || ''));
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
  } catch (e) {
    console.error('[WECHAT] 解密失败:', e.message);
    return null;
  }
}

module.exports = {
  createNativeOrder,
  queryOrder,
  verifyNotification,
  decryptResource,
  WECHAT_CONFIG
};