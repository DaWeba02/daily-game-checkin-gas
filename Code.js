const CONFIG = {
  timeZone: "Europe/Vienna",
  triggerHour: 18,
  triggerMinute: 20,
  discordMaxLength: 1900
};

const ZZZ = {
  name: "Zenless Zone Zero",
  shortName: "ZZZ",
  actId: "e202406031448091",
  signUrl: "https://sg-public-api.hoyolab.com/event/luna/zzz/os/sign?lang=en-us&act_id=e202406031448091",
  referer: "https://act.hoyolab.com/bbs/event/signin/zzz/e202406031448091.html?act_id=e202406031448091",
  extraHeaders: {
    "x-rpc-signgame": "zzz"
  },
  payload: function() {
    return { act_id: ZZZ.actId };
  }
};

const GENSHIN = {
  name: "Genshin Impact",
  shortName: "Genshin",
  actId: "e202102251931481",
  signUrl: "https://sg-hk4e-api.hoyolab.com/event/sol/sign?lang=en-us&act_id=e202102251931481",
  referer: "https://act.hoyolab.com/ys/event/signin-sea-v3/index.html?act_id=e202102251931481"
};

const HONKAI_STAR_RAIL = {
  name: "Honkai: Star Rail",
  shortName: "HSR",
  actId: "e202303301540311",
  signUrl: "https://sg-public-api.hoyolab.com/event/luna/os/sign?lang=en-us&act_id=e202303301540311",
  referer: "https://act.hoyolab.com/bbs/event/signin/hkrpg/index.html?act_id=e202303301540311",
  extraHeaders: {
    "x-rpc-signgame": "hkrpg"
  },
  payload: function() {
    return { act_id: HONKAI_STAR_RAIL.actId };
  }
};

const ENDFIELD = {
  name: "Arknights: Endfield",
  attendanceUrl: "https://zonai.skport.com/web/v1/game/endfield/attendance",
  refreshUrl: "https://zonai.skport.com/web/v1/auth/refresh",
  path: "/web/v1/game/endfield/attendance"
};

function checkInDailyRewards() {
  const props = PropertiesService.getScriptProperties();
  const results = [];

  results.push(formatRunTime_());

  results.push(checkInZZZ_(props));
  Utilities.sleep(1000);

  results.push(checkInGenshin_(props));
  Utilities.sleep(1000);

  results.push(checkInHonkaiStarRail_(props));
  Utilities.sleep(1000);

  results.push.apply(results, checkInEndfieldAll_(props));

  const message = results.join("\n");
  console.log(message);

  const discordWebhook = props.getProperty("DISCORD_WEBHOOK");
  if (discordWebhook) {
    console.log("Discord webhook configured. Sending message...");
    sendDiscord_(discordWebhook, message);
  } else {
    console.log("Discord skipped: DISCORD_WEBHOOK is not set.");
  }
}

function testZZZOnly() {
  const props = PropertiesService.getScriptProperties();
  console.log(checkInZZZ_(props));
}

function testGenshinOnly() {
  const props = PropertiesService.getScriptProperties();
  console.log(checkInGenshin_(props));
}

function testHonkaiStarRailOnly() {
  const props = PropertiesService.getScriptProperties();
  console.log(checkInHonkaiStarRail_(props));
}

function testEndfieldOnly() {
  const props = PropertiesService.getScriptProperties();
  const results = checkInEndfieldAll_(props);
  console.log(results.join("\n"));
}

function testDiscordOnly() {
  const props = PropertiesService.getScriptProperties();
  const webhook = props.getProperty("DISCORD_WEBHOOK");
  sendDiscord_(webhook, "Test message from Google Apps Script");
}

function testAllWithoutDiscord() {
  const props = PropertiesService.getScriptProperties();
  const results = [
    formatRunTime_(),
    checkInZZZ_(props),
    checkInGenshin_(props),
    checkInHonkaiStarRail_(props)
  ];

  results.push.apply(results, checkInEndfieldAll_(props));
  console.log(results.join("\n"));
}

function checkInZZZ_(props) {
  return checkInHoyolabGame_(props, ZZZ);
}

function checkInGenshin_(props) {
  return checkInHoyolabGame_(props, GENSHIN);
}

function checkInHonkaiStarRail_(props) {
  return checkInHoyolabGame_(props, HONKAI_STAR_RAIL);
}

function checkInHoyolabGame_(props, game) {
  const cookie = props.getProperty("HOYOLAB_COOKIE");

  if (!cookie) {
    return game.shortName + " skipped: HOYOLAB_COOKIE is not set.";
  }

  const headers = Object.assign({
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://act.hoyolab.com",
    "Referer": game.referer,
    "Cookie": cookie,
    "User-Agent": browserUserAgent_(),
    "x-rpc-app_version": "2.34.1",
    "x-rpc-client_type": "4",
    "x-rpc-language": "en-us"
  }, game.extraHeaders || {});

  const options = {
    method: "post",
    headers: headers,
    muteHttpExceptions: true
  };

  if (typeof game.payload === "function") {
    options.contentType = "application/json";
    options.payload = JSON.stringify(game.payload());
  }

  try {
    const response = UrlFetchApp.fetch(game.signUrl, options);
    const status = response.getResponseCode();
    const body = response.getContentText();
    const json = parseJson_(body);

    if (!json) {
      return game.shortName + " failed: HTTP " + status + ", non-JSON response: " + body.slice(0, 250);
    }

    const message = json.message || "";

    if (status >= 200 && status < 300 && json.retcode === 0) {
      return game.shortName + ": success - " + (message || "OK");
    }

    if (isAlreadyCheckedIn_(json.retcode, message)) {
      return game.shortName + ": already checked in - " + message;
    }

    if (json.data && json.data.gt_result && json.data.gt_result.is_risk) {
      return game.shortName + ": blocked by HoYoLAB risk check / CAPTCHA. Check in manually today.";
    }

    return game.shortName + ": failed - HTTP " + status + ", retcode " + json.retcode + ", message: " + message;
  } catch (error) {
    return game.shortName + " error: " + error.message;
  }
}

function checkInEndfieldAll_(props) {
  const raw = props.getProperty("ENDFIELD_PROFILES_JSON");

  if (!raw) {
    return ["Endfield skipped: ENDFIELD_PROFILES_JSON is not set."];
  }

  let profiles;
  try {
    profiles = JSON.parse(raw);
  } catch (error) {
    return ["Endfield error: ENDFIELD_PROFILES_JSON is not valid JSON - " + error.message];
  }

  if (!Array.isArray(profiles) || profiles.length === 0) {
    return ["Endfield skipped: ENDFIELD_PROFILES_JSON is empty."];
  }

  const results = [];

  for (const profile of profiles) {
    try {
      results.push(checkInEndfield_(profile));
    } catch (error) {
      const accountName = profile && profile.accountName ? profile.accountName : "Endfield";
      results.push("[" + accountName + "] Endfield error: " + error.message);
    }

    Utilities.sleep(1000);
  }

  return results;
}

function checkInEndfield_(profile) {
  validateEndfieldProfile_(profile);

  const accountName = profile.accountName || "main";
  const platform = String(profile.platform || "3");
  const vName = String(profile.vName || "1.0.0");

  const token = refreshEndfieldToken_(profile.cred, platform, vName);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const sign = generateEndfieldSign_(ENDFIELD.path, "", timestamp, token, platform, vName);

  const response = UrlFetchApp.fetch(ENDFIELD.attendanceUrl, {
    method: "post",
    headers: {
      "User-Agent": browserUserAgent_(),
      "Accept": "application/json, text/plain, */*",
      "Content-Type": "application/json",
      "Origin": "https://game.skport.com",
      "Referer": "https://game.skport.com/",
      "sk-language": "en",
      "sk-game-role": profile.skGameRole,
      "cred": profile.cred,
      "platform": platform,
      "vName": vName,
      "timestamp": timestamp,
      "sign": sign
    },
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  const body = response.getContentText();
  const json = parseJson_(body);

  if (!json) {
    return "[" + accountName + "] Endfield failed: HTTP " + status + ", non-JSON response: " + body.slice(0, 250);
  }

  if (json.code === 0) {
    return "[" + accountName + "] Endfield: success" + formatEndfieldRewards_(json);
  }

  const message = json.message || "Unknown error";

  if (
    json.code === 10001 ||
    json.code === 10000 ||
    message.toLowerCase().includes("already") ||
    message.toLowerCase().includes("do not sign in again")
  ) {
    return "[" + accountName + "] Endfield: already checked in - " + message;
  }

  return "[" + accountName + "] Endfield failed: HTTP " + status + ", code " + json.code + ", message: " + message;
}

function refreshEndfieldToken_(cred, platform, vName) {
  const response = UrlFetchApp.fetch(ENDFIELD.refreshUrl, {
    method: "get",
    headers: {
      "User-Agent": browserUserAgent_(),
      "Accept": "application/json, text/plain, */*",
      "cred": cred,
      "platform": platform,
      "vName": vName,
      "Origin": "https://game.skport.com",
      "Referer": "https://game.skport.com/"
    },
    muteHttpExceptions: true
  });

  const body = response.getContentText();
  const json = parseJson_(body);

  if (json && json.code === 0 && json.data && json.data.token) {
    return json.data.token;
  }

  throw new Error("token refresh failed: " + (json ? json.message : body.slice(0, 250)));
}

function generateEndfieldSign_(path, body, timestamp, token, platform, vName) {
  const headerJson = '{"platform":"' + platform + '","timestamp":"' + timestamp + '","dId":"","vName":"' + vName + '"}';
  const signSource = path + body + timestamp + headerJson;

  const hmacBytes = Utilities.computeHmacSha256Signature(signSource, token || "");
  const hmacHex = bytesToHex_(hmacBytes);

  const md5Bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, hmacHex);
  return bytesToHex_(md5Bytes);
}

function sendDiscord_(webhookUrl, content) {
  const cleanWebhookUrl = String(webhookUrl || "").trim();

  if (!cleanWebhookUrl) {
    console.log("Discord skipped: webhook URL is empty.");
    return;
  }

  const payload = JSON.stringify({
    username: "Daily Game Check-In",
    content: String(content || "").slice(0, CONFIG.discordMaxLength)
  });

  const options = {
    method: "post",
    contentType: "application/json",
    payload: payload,
    muteHttpExceptions: true
  };

  const discordUrl = appendQueryParam_(cleanWebhookUrl, "wait", "true");
  let response = UrlFetchApp.fetch(discordUrl, options);
  let status = response.getResponseCode();
  let body = response.getContentText();

  console.log("Discord webhook HTTP status: " + status);
  console.log("Discord webhook response body: " + body);

  if (status === 429) {
    const delayMs = getDiscordRetryDelayMs_(response, body);
    console.log("Discord rate-limited the request. Waiting " + Math.round(delayMs / 1000) + " seconds and retrying once...");
    Utilities.sleep(delayMs);

    response = UrlFetchApp.fetch(discordUrl, options);
    status = response.getResponseCode();
    body = response.getContentText();

    console.log("Discord retry HTTP status: " + status);
    console.log("Discord retry response body: " + body);
  }

  if (status < 200 || status >= 300) {
    console.log("Discord notification failed, but check-ins already completed.");
    return;
  }

  console.log("Discord notification sent successfully.");
}

function deleteAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();

  for (const trigger of triggers) {
    ScriptApp.deleteTrigger(trigger);
  }

  console.log("Deleted " + triggers.length + " trigger(s).");
}

function installDailyTrigger() {
  deleteAllTriggers();

  ScriptApp.newTrigger("checkInDailyRewards")
    .timeBased()
    .atHour(CONFIG.triggerHour)
    .nearMinute(CONFIG.triggerMinute)
    .everyDays(1)
    .inTimezone(CONFIG.timeZone)
    .create();

  console.log("Installed daily trigger for checkInDailyRewards around 18:20 Europe/Vienna.");
}

function formatRunTime_() {
  const now = new Date();
  return "Run time: " +
    Utilities.formatDate(now, CONFIG.timeZone, "yyyy-MM-dd HH:mm:ss z") +
    " | UTC+8: " +
    Utilities.formatDate(now, "Asia/Shanghai", "yyyy-MM-dd HH:mm:ss");
}

function formatEndfieldRewards_(json) {
  const data = json.data || {};
  const awardIds = data.awardIds || [];
  const resourceMap = data.resourceInfoMap || {};

  if (!awardIds.length) {
    return "";
  }

  const rewards = awardIds.map(function(award) {
    const id = award.id || award;
    const resource = resourceMap[id];

    if (resource) {
      return resource.name + " x" + (resource.count || 1);
    }

    return String(id);
  });

  return " - rewards: " + rewards.join(", ");
}

function validateEndfieldProfile_(profile) {
  if (!profile) {
    throw new Error("profile is empty.");
  }

  if (!profile.cred) {
    throw new Error("missing cred.");
  }

  if (!profile.skGameRole) {
    throw new Error("missing skGameRole.");
  }
}

function isAlreadyCheckedIn_(retcode, message) {
  const normalizedMessage = String(message || "").toLowerCase();
  return retcode === -5003 ||
    normalizedMessage.includes("already") ||
    normalizedMessage.includes("checked");
}

function getDiscordRetryDelayMs_(response, body) {
  const headers = response.getAllHeaders ? response.getAllHeaders() : {};
  const retryAfter = headers["Retry-After"] || headers["retry-after"];
  const parsedHeader = Number(retryAfter);

  if (!isNaN(parsedHeader) && parsedHeader > 0) {
    return clamp_(Math.ceil(parsedHeader * 1000), 5000, 120000);
  }

  const json = parseJson_(body);
  if (json && typeof json.retry_after === "number") {
    return clamp_(Math.ceil(json.retry_after * 1000), 5000, 120000);
  }

  return 60000;
}

function appendQueryParam_(url, key, value) {
  const separator = url.indexOf("?") === -1 ? "?" : "&";
  return url + separator + encodeURIComponent(key) + "=" + encodeURIComponent(value);
}

function parseJson_(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function bytesToHex_(bytes) {
  return bytes.map(function(byte) {
    return ("0" + (byte & 0xff).toString(16)).slice(-2);
  }).join("");
}

function browserUserAgent_() {
  return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
}

function clamp_(value, min, max) {
  return Math.max(min, Math.min(max, value));
}