// Netlify Function：钉钉日历同步转发
// 解决浏览器跨域问题，在服务器端调用钉钉 API

const APP_KEY = "dingltw0yn1uac2cyiu7";
const APP_SECRET = "0Kzn2k1iD8hpfk6r6slIwScaBqe1Fx9SpraO01MT0G53h_ppOV9oT4uCfIafCA8X";
const DEFAULT_USER_ID = "89I2AVX8Atz3fIoiPJFzpnAiEiE";
const DINGTALK_API = "https://api.dingtalk.com";

// 获取企业内部应用 access_token
async function getAccessToken() {
  const res = await fetch(`${DINGTALK_API}/v1.0/oauth2/accessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      appKey: APP_KEY,
      appSecret: APP_SECRET,
    }),
  });
  const data = await res.json();
  if (!data.accessToken) throw new Error("获取 accessToken 失败: " + JSON.stringify(data));
  return data.accessToken;
}

// 获取日历日程列表
async function getCalendarEvents(accessToken, userId, timeMin, timeMax) {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    maxResults: "100",
  });
  const url = `${DINGTALK_API}/v1.0/calendar/users/${userId}/calendars/primary/events?${params}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "x-acs-dingtalk-access-token": accessToken,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json();
  return data;
}

exports.handler = async (event, context) => {
  // 允许跨域
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json",
  };

  // 处理预检请求
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const params = event.queryStringParameters || {};
    const userId = params.userId || DEFAULT_USER_ID;

    // 默认查询范围：前后各 30 天
    const now = new Date();
    const timeMin = params.timeMin || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const timeMax = params.timeMax || new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();

    // 1. 获取 token
    const accessToken = await getAccessToken();

    // 2. 获取日程
    const result = await getCalendarEvents(accessToken, userId, timeMin, timeMax);

    // 3. 整理数据，只返回需要的字段
    const events = (result.events || []).map(e => ({
      id: e.id,
      title: e.summary || "（无标题）",
      start: e.start?.dateTime || e.start?.date || "",
      end: e.end?.dateTime || e.end?.date || "",
      location: e.location?.displayName || "",
      description: e.description || "",
      attendees: (e.attendees || []).map(a => a.displayName || a.id).join("、"),
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, events, total: events.length }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message }),
    };
  }
};
