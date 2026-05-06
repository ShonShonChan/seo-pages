export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") {
      return new Response("main worker is running");
    }

    let update;
    try {
      update = await request.json();
    } catch (error) {
      return new Response("invalid json", { status: 400 });
    }

    ctx.waitUntil(handleTelegramUpdate(update, env));
    return new Response("ok");
  }
};

async function handleTelegramUpdate(update, env) {
  let chatId = null;

  try {
    const message = update?.message;
    if (!message) return;

    chatId = message.chat?.id;
    const text = (message.text ?? "").trim();
    const lowerText = text.toLowerCase();
    const userId = String(message.from?.id ?? "");

    if (!chatId) return;

    if (userId !== String(env.ALLOWED_TELEGRAM_USER_ID)) {
      await sendTelegramMessage(env, chatId, "このbotは現在、管理者のみ利用できます。");
      return;
    }

    const historyKey = `chat:${chatId}`;
    const modeKey = `mode:${chatId}`;
    const taskKey = `task:${chatId}`;
    const memoryKey = `memory:${chatId}`;
    const pendingKey = `pending_apply:${chatId}`;

    if (text === "/reset") {
      await env.CHAT_HISTORY.delete(historyKey);
      await env.CHAT_HISTORY.delete(taskKey);
      await env.CHAT_HISTORY.delete(memoryKey);
      await env.CHAT_HISTORY.delete(pendingKey);
      await sendTelegramMessage(env, chatId, "会話履歴・内部状態・記憶・保留中の差分をリセットしました。");
      return;
    }

    if (lowerText === "github test") {
      const result = await githubReadFile(env, "index.html");

      if (!result.ok) {
        await sendTelegramMessage(env, chatId, `❌ GitHub接続テスト失敗\n\n${result.error}`);
        return;
      }

      await sendTelegramMessage(
        env,
        chatId,
        [
          "✅ GitHub接続成功",
          "",
          `repo: ${env.GITHUB_OWNER}/${env.GITHUB_REPO}`,
          "file: index.html",
          `branch: ${env.GITHUB_BRANCH || "main"}`,
          `文字数: ${result.content.length}`,
          `sha: ${result.sha}`
        ].join("\n")
      );
      return;
    }

    if (lowerText === "github rules test") {
      const handoff = await githubReadFile(env, "bot-handoff.md");
      const checklist = await githubReadFile(env, "auto-checklist.md");

      if (!handoff.ok || !checklist.ok) {
        await sendTelegramMessage(
          env,
          chatId,
          [
            "❌ ルールファイル読み取りテスト失敗",
            "",
            `bot-handoff.md: ${handoff.ok ? "OK" : handoff.error}`,
            `auto-checklist.md: ${checklist.ok ? "OK" : checklist.error}`
          ].join("\n")
        );
        return;
      }

      await sendTelegramMessage(
        env,
        chatId,
        [
          "✅ ルールファイル読み取り成功",
          "",
          `repo: ${env.GITHUB_OWNER}/${env.GITHUB_REPO}`,
          `branch: ${env.GITHUB_BRANCH || "main"}`,
          "",
          `bot-handoff.md: ${handoff.content.length}文字`,
          `auto-checklist.md: ${checklist.content.length}文字`
        ].join("\n")
      );
      return;
    }

    if (lowerText.startsWith("github diagnose ")) {
      const targetRaw = text.slice("github diagnose ".length).trim();
      const targetPath = normalizeGithubPagePath(targetRaw);

      if (!targetPath) {
        await sendTelegramMessage(
          env,
          chatId,
          [
            "❌ 診断対象が分かりませんでした。",
            "",
            "例:",
            "github diagnose index",
            "github diagnose bonus.html",
            "github diagnose review-slottenkoku.html"
          ].join("\n")
        );
        return;
      }

      await sendTelegramMessage(env, chatId, `GitHubから ${targetPath} を読み取り中...🔍`);

      const page = await githubReadFile(env, targetPath);

      if (!page.ok) {
        await sendTelegramMessage(
          env,
          chatId,
          [
            "❌ GitHub診断の読み取りに失敗しました。",
            "",
            `${targetPath}: ${page.error}`
          ].join("\n")
        );
        return;
      }

      const report = buildStaticSeoDiagnosis(targetPath, page.content);

      await sendLongTelegramMessage(
        env,
        chatId,
        [
          "✅ GitHub 静的SEO診断結果",
          "",
          `対象: ${targetPath}`,
          `repo: ${env.GITHUB_OWNER}/${env.GITHUB_REPO}`,
          `branch: ${env.GITHUB_BRANCH || "main"}`,
          "",
          report
        ].join("\n")
      );
      return;
    }

    if (lowerText === "github scan") {
      await sendTelegramMessage(env, chatId, "主要HTMLページをまとめて静的スキャン中...🔍");

      const pages = getDefaultScanPages();
      const results = [];

      for (const path of pages) {
        const page = await githubReadFile(env, path);

        if (!page.ok) {
          results.push({ path, ok: false, error: page.error });
          continue;
        }

        results.push({
          path,
          ok: true,
          summary: buildStaticSeoSummary(path, page.content)
        });
      }

      await sendLongTelegramMessage(env, chatId, buildGithubScanReport(env, results));
      return;
    }

    if (lowerText.startsWith("github propose ")) {
      const targetRaw = text.slice("github propose ".length).trim();
      const targetPath = normalizeGithubPagePath(targetRaw);

      if (!targetPath) {
        await sendTelegramMessage(
          env,
          chatId,
          [
            "❌ 改善案の対象が分かりませんでした。",
            "",
            "例:",
            "github propose index",
            "github propose bonus.html",
            "github propose review-slottenkoku.html"
          ].join("\n")
        );
        return;
      }

      await sendTelegramMessage(env, chatId, `GitHubから ${targetPath} を読み取り、改善案を作成中...🛠️`);

      const page = await githubReadFile(env, targetPath);

      if (!page.ok) {
        await sendTelegramMessage(
          env,
          chatId,
          [
            "❌ 改善案作成用の読み取りに失敗しました。",
            "",
            `${targetPath}: ${page.error}`
          ].join("\n")
        );
        return;
      }

      const proposal = buildStaticImprovementProposal(targetPath, page.content);

      await sendLongTelegramMessage(
        env,
        chatId,
        [
          "✅ GitHub 改善案",
          "",
          `対象: ${targetPath}`,
          `repo: ${env.GITHUB_OWNER}/${env.GITHUB_REPO}`,
          `branch: ${env.GITHUB_BRANCH || "main"}`,
          "",
          proposal,
          "",
          "※まだ編集・commitはしていません。"
        ].join("\n")
      );
      return;
    }

    if (lowerText.startsWith("github diff ")) {
      const targetRaw = text.slice("github diff ".length).trim();
      const targetPath = normalizeGithubPagePath(targetRaw);

      if (!targetPath) {
        await sendTelegramMessage(
          env,
          chatId,
          [
            "❌ diff対象が分かりませんでした。",
            "",
            "例:",
            "github diff index",
            "github diff bonus.html",
            "github diff review-slottenkoku.html"
          ].join("\n")
        );
        return;
      }

      await sendTelegramMessage(env, chatId, `GitHubから ${targetPath} を読み取り、差分プレビューを作成中...🧾`);

      const page = await githubReadFile(env, targetPath);

      if (!page.ok) {
        await sendTelegramMessage(
          env,
          chatId,
          [
            "❌ diff作成用の読み取りに失敗しました。",
            "",
            `${targetPath}: ${page.error}`
          ].join("\n")
        );
        return;
      }

      const plan = buildSafeStaticEditPlan(targetPath, page.content);
      const diffPreview = buildStaticDiffPreview(targetPath, page.content, plan);

      if (plan.changes.length > 0) {
        await env.CHAT_HISTORY.put(
          pendingKey,
          JSON.stringify({
            targetPath,
            sha: page.sha,
            nextHtml: plan.nextHtml,
            changes: plan.changes,
            createdAt: new Date().toISOString()
          }),
          { expirationTtl: 60 * 30 }
        );
      } else {
        await env.CHAT_HISTORY.delete(pendingKey);
      }

      await sendLongTelegramMessage(
        env,
        chatId,
        [
          "✅ GitHub 差分プレビュー",
          "",
          `対象: ${targetPath}`,
          `repo: ${env.GITHUB_OWNER}/${env.GITHUB_REPO}`,
          `branch: ${env.GITHUB_BRANCH || "main"}`,
          "",
          diffPreview,
          "",
          plan.changes.length > 0
            ? `この内容で反映する場合は、次に \`github apply ${targetPath}\` を送ってください。`
            : "反映対象の差分がないため、applyは不要です。",
          "",
          "※まだGitHubには書き込んでいません。"
        ].join("\n")
      );
      return;
    }

    if (lowerText.startsWith("github apply ")) {
      const targetRaw = text.slice("github apply ".length).trim();
      const targetPath = normalizeGithubPagePath(targetRaw);

      if (!targetPath) {
        await sendTelegramMessage(
          env,
          chatId,
          [
            "❌ apply対象が分かりませんでした。",
            "",
            "例:",
            "github apply index",
            "github apply bonus.html"
          ].join("\n")
        );
        return;
      }

      const pending = await safeGetJson(env.CHAT_HISTORY, pendingKey, null);

      if (!pending || pending.targetPath !== targetPath || !pending.nextHtml || !pending.sha) {
        await sendTelegramMessage(
          env,
          chatId,
          [
            "❌ 反映できる保留中の差分がありません。",
            "",
            "安全のため、先に差分確認が必要です。",
            "",
            `先に実行してください: github diff ${targetPath}`
          ].join("\n")
        );
        return;
      }

      await sendTelegramMessage(env, chatId, `GitHubへ ${targetPath} の差分を反映中...🚀`);

      const writeResult = await githubWriteFile(
        env,
        targetPath,
        pending.nextHtml,
        pending.sha,
        `Apply safe SEO fixes to ${targetPath}`
      );

      if (!writeResult.ok) {
        await sendTelegramMessage(
          env,
          chatId,
          [
            "❌ GitHubへの反映に失敗しました。",
            "",
            writeResult.error
          ].join("\n")
        );
        return;
      }

      await env.CHAT_HISTORY.delete(pendingKey);

      await sendTelegramMessage(
        env,
        chatId,
        [
          "✅ GitHub反映・commit成功",
          "",
          `対象: ${targetPath}`,
          `repo: ${env.GITHUB_OWNER}/${env.GITHUB_REPO}`,
          `branch: ${env.GITHUB_BRANCH || "main"}`,
          `変更数: ${pending.changes?.length || 0}件`,
          "",
          `commit: ${writeResult.commitSha || "-"}`,
          writeResult.commitUrl ? `url: ${writeResult.commitUrl}` : "",
          "",
          "次にGitHub Pages側で反映確認してください。"
        ].filter(Boolean).join("\n")
      );
      return;
    }

    if (text === "/help") {
      await sendTelegramMessage(
        env,
        chatId,
        [
          "このbotは基本、そのまま話しかけるだけでOKやで👇",
          "",
          "GitHub系コマンド",
          "github test - GitHub接続テスト",
          "github rules test - ルールファイル読み取りテスト",
          "github diagnose index - 静的SEO診断",
          "github scan - 主要HTMLをまとめて軽量スキャン",
          "github propose index - 改善案を作成",
          "github diff index - 差分プレビューを作成",
          "github apply index - 直前のdiffをGitHubへ反映・commit",
          "",
          "安全ルール",
          "- applyは直前にdiffを作ったページだけ実行可能",
          "- いきなりcommitはできません",
          "- 反映対象は静的で安全な修正候補のみ",
          "",
          "その他",
          "/status - 現在の内部状態を確認",
          "/mode - 現在のモードを確認",
          "/reset - 会話履歴・内部状態・記憶・保留diffをリセット"
        ].join("\n")
      );
      return;
    }

    if (text === "/mode") {
      const currentMode = (await env.CHAT_HISTORY.get(modeKey)) || "auto";
      await sendTelegramMessage(env, chatId, `現在のモードは ${currentMode} です。`);
      return;
    }

    if (text === "/status") {
      const currentMode = (await env.CHAT_HISTORY.get(modeKey)) || "auto";
      const taskState = await safeGetJson(env.CHAT_HISTORY, taskKey, null);
      const memoryState = await safeGetJson(env.CHAT_HISTORY, memoryKey, null);
      const pending = await safeGetJson(env.CHAT_HISTORY, pendingKey, null);

      await sendTelegramMessage(
        env,
        chatId,
        [
          buildStatusText(currentMode, taskState),
          "",
          buildMemoryStatusText(memoryState),
          "",
          pending
            ? `保留中の差分:\n- file: ${pending.targetPath}\n- changes: ${pending.changes?.length || 0}件\n- createdAt: ${pending.createdAt || "-"}`
            : "保留中の差分: なし"
        ].join("\n")
      );
      return;
    }

    if (text.startsWith("/mode ")) {
      const requestedMode = text.replace("/mode", "").trim().toLowerCase();
      const allowedModes = ["chat", "dev", "seo", "auto"];

      if (!allowedModes.includes(requestedMode)) {
        await sendTelegramMessage(
          env,
          chatId,
          "指定できるモードは chat / dev / seo / auto です。例: /mode auto"
        );
        return;
      }

      await env.CHAT_HISTORY.put(modeKey, requestedMode);
      await sendTelegramMessage(env, chatId, `モードを ${requestedMode} に変更しました。`);
      return;
    }

    await sendTelegramMessage(env, chatId, "考え中...🤔");

    const currentMode = (await env.CHAT_HISTORY.get(modeKey)) || "auto";
    const effectiveMode = currentMode === "auto" ? detectModeFromText(text) : currentMode;

    const savedHistory = await safeGetJson(env.CHAT_HISTORY, historyKey, []);
    let messages = Array.isArray(savedHistory) ? savedHistory : [];

    const previousTaskState = await safeGetJson(env.CHAT_HISTORY, taskKey, null);
    const previousMemoryState = await safeGetJson(env.CHAT_HISTORY, memoryKey, null);

    const currentTaskState = inferTaskState(text, effectiveMode, previousTaskState);
    const currentMemoryState = updateMemoryState(text, effectiveMode, previousMemoryState);

    await env.CHAT_HISTORY.put(taskKey, JSON.stringify(currentTaskState));
    await env.CHAT_HISTORY.put(memoryKey, JSON.stringify(currentMemoryState));

    if (isMemoryQuestion(text)) {
      await sendLongTelegramMessage(env, chatId, buildMemoryAnswer(currentMemoryState));
      return;
    }

    messages.push({ role: "user", content: text });
    messages = messages.slice(-10);

    const systemPrompt = buildSystemPrompt(effectiveMode, currentMode, currentTaskState, currentMemoryState);
    const useWebSearch = shouldUseWebSearch(text, effectiveMode);
    const timeoutMs = useWebSearch ? 60000 : 30000;
    const maxTokens = useWebSearch ? 900 : 1400;

    let result = await runClaudeSimple(env, systemPrompt, messages, timeoutMs, maxTokens, useWebSearch);

    if (!result.ok && result.timedOut && useWebSearch) {
      const retryResult = await runClaudeSimple(env, systemPrompt, messages, 15000, 900, false);

      if (retryResult.ok) {
        retryResult.replyText = "※検索処理が長引いたため、まず通常回答で返してるで。\n\n" + retryResult.replyText;
      }

      result = retryResult;
    }

    const replyText = result.replyText || "返答を取得できませんでした。";

    if (result.ok) {
      messages.push({ role: "assistant", content: replyText });
      messages = messages.slice(-10);
      await env.CHAT_HISTORY.put(historyKey, JSON.stringify(messages));
    }

    await sendLongTelegramMessage(env, chatId, replyText);
  } catch (error) {
    if (chatId) {
      await sendTelegramMessage(env, chatId, `Worker error: ${error.message}`);
    }
  }
}

function getDefaultScanPages() {
  return [
    "index.html",
    "bonus.html",
    "bonus-best.html",
    "bonus-guide.html",
    "casino-list.html",
    "guide.html",
    "payments.html",
    "review.html",
    "review-slottenkoku.html",
    "site-checklist.html"
  ];
}

function normalizeGithubPagePath(input) {
  const value = String(input || "").trim();

  if (!value) return "";
  if (value === "index" || value === "/") return "index.html";

  const cleaned = value
    .replace(/^https?:\/\/shonshonchan\.github\.io\/seo-pages\//i, "")
    .replace(/^\/+/, "");

  if (!cleaned) return "";
  if (cleaned.includes("..")) return "";

  if (cleaned.endsWith(".html") || cleaned.endsWith(".md") || cleaned.endsWith(".txt")) {
    return cleaned;
  }

  return `${cleaned}.html`;
}

function buildStaticSeoSummary(targetPath, html) {
  const title = extractTitle(html);
  const description = extractMetaDescription(html);
  const h1List = extractHeadings(html, "h1");
  const h2List = extractHeadings(html, "h2");
  const internalLinks = extractInternalLinks(html);
  const imageStats = analyzeImages(html);
  const dangerMatches = findDangerExpressions(html);

  const issues = [];

  if (!title) issues.push("titleなし");
  if (!description) issues.push("descriptionなし");
  if (h1List.length !== 1) issues.push(`h1=${h1List.length}`);
  if (h2List.length === 0) issues.push("h2なし");
  if (description.length > 120) issues.push(`description長め(${description.length})`);
  if (description.length > 0 && description.length < 60) issues.push(`description短め(${description.length})`);
  if (title.length > 55) issues.push(`title長め(${title.length})`);
  if (title.length > 0 && title.length < 20) issues.push(`title短め(${title.length})`);
  if (internalLinks.length < 3) issues.push(`内部リンク少なめ(${internalLinks.length})`);
  if (imageStats.missingAlt > 0) issues.push(`alt不足=${imageStats.missingAlt}`);
  if (dangerMatches.length > 0) issues.push(`危険表現候補=${dangerMatches.length}`);

  return {
    title,
    titleLen: title.length,
    descriptionLen: description.length,
    h1Count: h1List.length,
    h2Count: h2List.length,
    internalLinkCount: internalLinks.length,
    imageCount: imageStats.total,
    missingAltCount: imageStats.missingAlt,
    dangerCount: dangerMatches.length,
    issues
  };
}

function buildGithubScanReport(env, results) {
  const lines = [];

  lines.push("✅ GitHub 主要ページ静的スキャン結果");
  lines.push("");
  lines.push(`repo: ${env.GITHUB_OWNER}/${env.GITHUB_REPO}`);
  lines.push(`branch: ${env.GITHUB_BRANCH || "main"}`);
  lines.push("");

  let okCount = 0;
  let warningCount = 0;
  let errorCount = 0;

  for (const result of results) {
    if (!result.ok) {
      errorCount += 1;
      continue;
    }

    if (result.summary.issues.length > 0) {
      warningCount += 1;
    } else {
      okCount += 1;
    }
  }

  lines.push("1. 全体サマリー");
  lines.push(`- OK: ${okCount}ページ`);
  lines.push(`- 改善候補あり: ${warningCount}ページ`);
  lines.push(`- 読み取り失敗: ${errorCount}ページ`);
  lines.push("");

  lines.push("2. ページ別結果");

  for (const result of results) {
    if (!result.ok) {
      lines.push("");
      lines.push(`❌ ${result.path}`);
      lines.push(`- error: ${result.error}`);
      continue;
    }

    const s = result.summary;
    const mark = s.issues.length === 0 ? "✅" : "⚠️";

    lines.push("");
    lines.push(`${mark} ${result.path}`);
    lines.push(`- title: ${s.titleLen}文字`);
    lines.push(`- description: ${s.descriptionLen}文字`);
    lines.push(`- h1: ${s.h1Count}件 / h2: ${s.h2Count}件`);
    lines.push(`- 内部リンク: ${s.internalLinkCount}件`);
    lines.push(`- 画像: ${s.imageCount}件 / alt不足: ${s.missingAltCount}件`);
    lines.push(`- 危険表現候補: ${s.dangerCount}件`);
    lines.push(`- 改善候補: ${s.issues.length ? s.issues.join(" / ") : "なし"}`);
  }

  lines.push("");
  lines.push("3. 次にやること");
  lines.push("- 改善候補ありのページに対して `github propose ページ名` を実行");
  lines.push("- 例: `github propose bonus.html`");
  lines.push("- まだ編集・commitは行っていません");

  return lines.join("\n");
}

function buildStaticSeoDiagnosis(targetPath, html) {
  const title = extractTitle(html);
  const description = extractMetaDescription(html);
  const h1List = extractHeadings(html, "h1");
  const h2List = extractHeadings(html, "h2");
  const h3List = extractHeadings(html, "h3");

  const internalLinks = extractInternalLinks(html);
  const externalLinks = extractExternalLinks(html);
  const imageStats = analyzeImages(html);
  const dangerMatches = findDangerExpressions(html);

  const titleLen = title.length;
  const descLen = description.length;

  const issues = [];
  const good = [];
  const nextActions = [];

  if (title) good.push(`titleあり: ${titleLen}文字`);
  else {
    issues.push("titleタグが見つかりません。");
    nextActions.push("titleタグを追加する。");
  }

  if (description) good.push(`meta descriptionあり: ${descLen}文字`);
  else {
    issues.push("meta descriptionが見つかりません。");
    nextActions.push("meta descriptionを追加する。");
  }

  if (h1List.length === 1) good.push("h1が1つだけ設定されています。");
  else if (h1List.length === 0) {
    issues.push("h1が見つかりません。");
    nextActions.push("ページ主題を表すh1を1つ追加する。");
  } else {
    issues.push(`h1が${h1List.length}個あります。基本は1ページ1つが望ましいです。`);
    nextActions.push("h1を1つに整理し、他はh2/h3へ調整する。");
  }

  if (titleLen > 0 && titleLen < 20) {
    issues.push(`titleが短めです: ${titleLen}文字`);
    nextActions.push("titleに検索意図・ページ内容・サイト名を自然に含める。");
  }

  if (titleLen > 55) {
    issues.push(`titleが長めです: ${titleLen}文字`);
    nextActions.push("titleを重要語句優先で少し短くする。");
  }

  if (descLen > 0 && descLen < 60) {
    issues.push(`descriptionが短めです: ${descLen}文字`);
    nextActions.push("descriptionに確認できる条件・対象・安全確認の方向性を追加する。");
  }

  if (descLen > 120) {
    issues.push(`descriptionがやや長めです: ${descLen}文字`);
    nextActions.push("descriptionを100文字前後に整理する。");
  }

  if (internalLinks.length >= 3) good.push(`内部リンクあり: ${internalLinks.length}件`);
  else {
    issues.push(`内部リンクが少なめです: ${internalLinks.length}件`);
    nextActions.push("関連ページへの内部リンクを追加する。");
  }

  if (imageStats.total > 0) good.push(`画像あり: ${imageStats.total}件`);

  if (imageStats.missingAlt > 0) {
    issues.push(`altが空または不足している画像があります: ${imageStats.missingAlt}件`);
    nextActions.push("画像altを、煽りではなく内容説明に寄せて整える。");
  }

  if (dangerMatches.length === 0) good.push("危険表現候補は検出されませんでした。");
  else {
    issues.push(`危険表現候補があります: ${dangerMatches.length}件`);
    nextActions.push("勝利保証・出金保証・損失回収・必ず勝てる系の表現を注意書きかNG例に限定する。");
  }

  if (h2List.length === 0) {
    issues.push("h2が見つかりません。ページ構造が弱い可能性があります。");
    nextActions.push("主要セクションにh2を追加する。");
  } else {
    good.push(`h2あり: ${h2List.length}件`);
  }

  const dangerLines = dangerMatches.length
    ? dangerMatches.slice(0, 10).map((m) => `- ${m.term}: ${m.count}件`).join("\n")
    : "- なし";

  return [
    "1. 結論",
    issues.length === 0
      ? "このページは基本的なSEOタグと構造が整っています。"
      : "このページは公開可能な状態ですが、いくつか改善候補があります。",
    "",
    "2. 基本情報",
    `- file: ${targetPath}`,
    `- title(${titleLen}): ${title || "なし"}`,
    `- description(${descLen}): ${description || "なし"}`,
    `- h1(${h1List.length}): ${h1List.length ? h1List.join(" / ") : "なし"}`,
    `- h2: ${h2List.length}件`,
    `- h3: ${h3List.length}件`,
    `- 内部リンク: ${internalLinks.length}件`,
    `- 外部リンク: ${externalLinks.length}件`,
    `- 画像: ${imageStats.total}件`,
    `- alt不足画像: ${imageStats.missingAlt}件`,
    "",
    "3. 良い点",
    good.length ? good.map((item) => `- ${item}`).join("\n") : "- 目立つ良い点は未検出です。",
    "",
    "4. 修正した方がいい点",
    issues.length ? issues.map((item) => `- ${item}`).join("\n") : "- 大きな問題は見つかりませんでした。",
    "",
    "5. 危険表現候補",
    dangerLines,
    "",
    "6. 次にbotへ依頼するなら",
    uniqueList(nextActions).length
      ? uniqueList(nextActions).map((item) => `- ${item}`).join("\n")
      : "- 今すぐ修正必須の項目は少なめです。次は本文導線やCTAの質を確認すると良いです。",
    "",
    "※これはCloudflare Worker内だけで行う軽量診断です。"
  ].join("\n");
}

function buildStaticImprovementProposal(targetPath, html) {
  const summary = buildStaticSeoSummary(targetPath, html);
  const title = extractTitle(html);
  const description = extractMetaDescription(html);
  const h1List = extractHeadings(html, "h1");
  const h2List = extractHeadings(html, "h2");
  const internalLinks = extractInternalLinks(html);
  const dangerMatches = findDangerExpressions(html);
  const imageStats = analyzeImages(html);

  const proposals = [];

  if (!title) {
    proposals.push({
      priority: "高",
      area: "title",
      detail: "titleタグがないため、ページ主題と検索意図が伝わるtitleを追加する。",
      example: "例: ページ名 | 条件確認・比較ガイド | リベンジカジノ比較ガイド"
    });
  } else if (title.length < 20) {
    proposals.push({
      priority: "中",
      area: "title",
      detail: `titleが短めです。現在${title.length}文字なので、検索意図・対象・サイト名を自然に補う。`,
      example: "例: ボーナス比較 | 賭け条件・最大出金・対象ゲームを確認 | リベンジカジノ比較ガイド"
    });
  } else if (title.length > 55) {
    proposals.push({
      priority: "中",
      area: "title",
      detail: `titleが長めです。現在${title.length}文字なので、重要語句を前半に寄せて短縮する。`,
      example: "例: 重要語句 → ページ主題 → サイト名の順に整理"
    });
  }

  if (!description) {
    proposals.push({
      priority: "高",
      area: "meta description",
      detail: "meta descriptionがないため、ページ内容・確認できる条件・安全確認の方向性を100文字前後で追加する。",
      example: "例: オンラインカジノを利用前に確認したい条件、入出金、本人確認、公式規約の確認ポイントを整理しています。"
    });
  } else if (description.length < 60) {
    proposals.push({
      priority: "中",
      area: "meta description",
      detail: `descriptionが短めです。現在${description.length}文字なので、ページで確認できる内容を補う。`,
      example: "例: 条件確認・比較・安全性確認・初心者向けの導線を自然に含める。"
    });
  } else if (description.length > 120) {
    proposals.push({
      priority: "中",
      area: "meta description",
      detail: `descriptionがやや長めです。現在${description.length}文字なので100文字前後に圧縮する。`,
      example: "例: 重複語を減らし、確認できる項目を短く並べる。"
    });
  }

  if (h1List.length === 0) {
    proposals.push({
      priority: "高",
      area: "h1",
      detail: "h1がないため、ページ主題を表すh1を1つ追加する。",
      example: "例: オンラインカジノの条件確認ガイド"
    });
  } else if (h1List.length > 1) {
    proposals.push({
      priority: "高",
      area: "h1",
      detail: `h1が${h1List.length}個あります。主題のh1を1つに絞り、他はh2/h3へ変更する。`,
      example: "例: 最上位見出しだけh1、セクション見出しはh2へ整理"
    });
  }

  if (h2List.length === 0) {
    proposals.push({
      priority: "中",
      area: "見出し構造",
      detail: "h2がないため、ページ内の主要セクションをh2で整理する。",
      example: "例: 確認ポイント / 比較項目 / 注意点 / よくある質問"
    });
  }

  if (internalLinks.length < 3) {
    proposals.push({
      priority: "中",
      area: "内部リンク",
      detail: `内部リンクが少なめです。現在${internalLinks.length}件なので関連ページへの導線を追加する。`,
      example: "例: bonus.html、payments.html、guide.html、review.html への自然なリンクを追加"
    });
  }

  if (imageStats.missingAlt > 0) {
    proposals.push({
      priority: "中",
      area: "画像alt",
      detail: `alt不足画像が${imageStats.missingAlt}件あります。画像内容を説明するaltへ整える。`,
      example: "例: 確認ポイントを案内するリベ男 / 入出金条件を案内するリベ女"
    });
  }

  if (dangerMatches.length > 0) {
    proposals.push({
      priority: "高",
      area: "危険表現",
      detail: `危険表現候補が${dangerMatches.length}種類あります。保証・損失回収・必勝系の表現を避ける。`,
      example: "例: 「必ず勝てる」ではなく「条件達成時に対象」「公式規約を確認」へ置き換える。"
    });
  }

  if (proposals.length === 0) {
    proposals.push({
      priority: "低",
      area: "追加改善",
      detail: "基本的なSEO構造は整っています。次は本文導線、CTA、FAQ、責任ある利用案内の質を確認すると良いです。",
      example: "例: 初心者が次に読むべきページへの導線や、公式規約確認の注意書きを強化する。"
    });
  }

  return [
    "1. 結論",
    summary.issues.length === 0
      ? "大きな技術的SEO問題は少なめです。改善するなら本文導線・CTA・注意書きの質を上げる段階です。"
      : "いくつか改善候補があります。まず高優先度から対応すると良いです。",
    "",
    "2. 現在の状態",
    `- title: ${summary.titleLen}文字`,
    `- description: ${summary.descriptionLen}文字`,
    `- h1: ${summary.h1Count}件`,
    `- h2: ${summary.h2Count}件`,
    `- 内部リンク: ${summary.internalLinkCount}件`,
    `- 画像: ${summary.imageCount}件`,
    `- alt不足: ${summary.missingAltCount}件`,
    `- 危険表現候補: ${summary.dangerCount}件`,
    "",
    "3. 改善案",
    proposals.map((p, index) => [
      `${index + 1}. [${p.priority}] ${p.area}`,
      `- 内容: ${p.detail}`,
      `- 方向性: ${p.example}`
    ].join("\n")).join("\n\n"),
    "",
    "4. 次の一手",
    "- まずこの改善案を確認",
    "- 問題なければ `github diff <page>` で差分プレビューを確認",
    "- diff確認後、`github apply <page>` でcommitできます"
  ].join("\n");
}

function buildStaticDiffPreview(targetPath, html, plan) {
  if (plan.changes.length === 0) {
    return [
      "1. 結論",
      "自動で安全に差し替えできる変更候補はありませんでした。",
      "",
      "2. 状態",
      "- 現時点では title / description / 危険表現候補の自動修正対象が見つかりません。",
      "- 文章全体の改善やCTA調整は、手動レビュー対象にするのが安全です。",
      "",
      "3. 次の一手",
      `- \`github propose ${targetPath}\` で改善案を確認`,
      "- 必要に応じて、修正したい内容を具体的に指定してください。"
    ].join("\n");
  }

  const lines = [];

  lines.push("1. 結論");
  lines.push(`${plan.changes.length}件の安全な差分候補を作成しました。`);
  lines.push("");

  lines.push("2. 差分候補");
  plan.changes.forEach((change, index) => {
    lines.push("");
    lines.push(`${index + 1}. ${change.area}`);
    lines.push(`- 理由: ${change.reason}`);
    lines.push("- 変更前:");
    lines.push(`  ${truncateLine(change.before, 220)}`);
    lines.push("- 変更後:");
    lines.push(`  ${truncateLine(change.after, 220)}`);
  });

  lines.push("");
  lines.push("3. 変更サマリー");
  lines.push(`- 対象ファイル: ${targetPath}`);
  lines.push(`- 変更候補数: ${plan.changes.length}`);
  lines.push(`- 変更前文字数: ${String(html || "").length}`);
  lines.push(`- 変更後文字数: ${plan.nextHtml.length}`);
  lines.push("");

  lines.push("4. 重要");
  lines.push("- これは差分プレビューのみです。");
  lines.push("- まだGitHubには書き込んでいません。");
  lines.push("- 反映する場合は、この後に `github apply <page>` を送ってください。");

  return lines.join("\n");
}

function buildSafeStaticEditPlan(targetPath, html) {
  let nextHtml = String(html || "");
  const changes = [];

  const dangerReplacements = [
    ["必ず勝てる", "条件を確認する"],
    ["絶対勝てる", "条件を確認する"],
    ["確実に勝てる", "条件を確認する"],
    ["確実に稼げる", "条件を確認する"],
    ["必ず稼げる", "条件を確認する"],
    ["勝利保証", "勝利を保証する表現"],
    ["出金保証", "出金条件の確認"],
    ["損失回収", "リスク理解"],
    ["負けを取り戻す", "失敗を次の確認に活かす"],
    ["一攫千金", "条件を確認したうえで利用する"]
  ];

  for (const [from, to] of dangerReplacements) {
    const count = countOccurrences(stripTags(nextHtml), from);

    if (count > 0) {
      nextHtml = replaceAllLiteral(nextHtml, from, to);
      changes.push({
        area: "危険表現",
        reason: `「${from}」が${count}件見つかったため、保証・煽りに見えにくい表現へ置換候補を作成。`,
        before: from,
        after: to
      });
    }
  }

  const title = extractTitle(nextHtml);
  if (!title) {
    const suggestedTitle = buildSuggestedTitle(targetPath);

    if (nextHtml.includes("<head>")) {
      const beforeHtml = "<head>";
      const afterHtml = `<head>\n  <title>${escapeHtmlText(suggestedTitle)}</title>`;
      nextHtml = nextHtml.replace("<head>", afterHtml);

      changes.push({
        area: "title",
        reason: "titleタグが見つからないため、ページ主題に合わせたtitle追加候補を作成。",
        before: beforeHtml,
        after: afterHtml
      });
    }
  } else if (title.length > 58) {
    const suggestedTitle = buildSuggestedTitle(targetPath, title);
    nextHtml = replaceTitle(nextHtml, suggestedTitle);

    changes.push({
      area: "title",
      reason: `titleが長めです。現在${title.length}文字のため、短縮候補を作成。`,
      before: title,
      after: suggestedTitle
    });
  }

  const description = extractMetaDescription(nextHtml);
  if (!description) {
    const suggestedDescription = buildSuggestedDescription(targetPath);
    const metaTag = `<meta name="description" content="${escapeHtmlAttribute(suggestedDescription)}" />`;

    if (nextHtml.includes("<head>")) {
      nextHtml = nextHtml.replace("<head>", `<head>\n  ${metaTag}`);

      changes.push({
        area: "meta description",
        reason: "meta descriptionが見つからないため、説明文追加候補を作成。",
        before: "なし",
        after: metaTag
      });
    }
  } else if (description.length > 125) {
    const suggestedDescription = buildSuggestedDescription(targetPath, description);
    nextHtml = replaceMetaDescription(nextHtml, suggestedDescription);

    changes.push({
      area: "meta description",
      reason: `descriptionが長めです。現在${description.length}文字のため、短縮候補を作成。`,
      before: description,
      after: suggestedDescription
    });
  }

  return { nextHtml, changes };
}

function buildSuggestedTitle(targetPath, currentTitle = "") {
  const path = String(targetPath || "");

  if (path.includes("bonus")) return "ボーナス比較 | 賭け条件・最大出金・対象ゲームを確認";
  if (path.includes("payments")) return "入出金ガイド | 本人確認・手数料・反映時間を確認";
  if (path.includes("review-slottenkoku")) return "スロット天国レビュー | 条件・入出金・本人確認を確認";
  if (path.includes("review")) return "オンラインカジノレビュー一覧 | 条件確認・比較ガイド";
  if (path.includes("guide")) return "初心者ガイド | 登録前に見る順番と確認ポイント";
  if (path.includes("casino-list")) return "オンラインカジノ一覧 | 条件確認・比較ガイド";

  if (currentTitle) {
    const cleaned = cleanText(currentTitle)
      .replace("リベンジカジノ比較ガイド", "")
      .replace(/\|+\s*$/, "")
      .trim();

    return truncateLine(`${cleaned} | リベンジカジノ比較ガイド`, 56);
  }

  return "リベンジカジノ比較ガイド | 条件確認・比較サイト";
}

function buildSuggestedDescription(targetPath, currentDescription = "") {
  const path = String(targetPath || "");

  if (path.includes("bonus")) {
    return "オンラインカジノのボーナス比較ページです。賭け条件、最大出金、対象ゲーム、有効期限、禁止ベットを利用前に確認できます。";
  }

  if (path.includes("payments")) {
    return "オンラインカジノの入出金ガイドです。入金方法、出金方法、本人確認、必要書類、手数料、反映時間を確認できます。";
  }

  if (path.includes("review-slottenkoku")) {
    return "スロット天国のレビュー記事です。ボーナス条件、賭け条件、最大出金、対象ゲーム、入出金方法、本人確認を確認できます。";
  }

  if (path.includes("review")) {
    return "オンラインカジノのレビュー一覧ページです。各サイトの条件、入出金、本人確認、公式規約の確認ポイントを整理しています。";
  }

  if (path.includes("guide")) {
    return "オンラインカジノ初心者向けの確認ガイドです。登録前に見るべき条件、本人確認、入出金、公式規約の確認順を整理しています。";
  }

  if (path.includes("casino-list")) {
    return "オンラインカジノ一覧ページです。各サイトのボーナス条件、入出金、本人確認、公式規約の確認ポイントを比較できます。";
  }

  if (currentDescription) return truncateLine(cleanText(currentDescription), 112);

  return "オンラインカジノを利用前に確認したい条件、比較ポイント、安全性、入出金、本人確認、公式規約の確認項目を整理しています。";
}

function replaceTitle(html, newTitle) {
  return String(html || "").replace(
    /<title[^>]*>[\s\S]*?<\/title>/i,
    `<title>${escapeHtmlText(newTitle)}</title>`
  );
}

function replaceMetaDescription(html, newDescription) {
  const value = escapeHtmlAttribute(newDescription);
  const text = String(html || "");

  return text.replace(/<meta\b[^>]*name=["']description["'][^>]*>/i, (tag) => {
    if (/\bcontent=["'][^"']*["']/.test(tag)) {
      return tag.replace(/\bcontent=["'][^"']*["']/, `content="${value}"`);
    }

    return tag.replace(/\/?>$/, ` content="${value}" />`);
  });
}

function replaceAllLiteral(text, from, to) {
  return String(text || "").split(from).join(to);
}

function truncateLine(text, maxLength) {
  const value = cleanText(String(text || ""));

  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

function escapeHtmlText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlAttribute(value) {
  return escapeHtmlText(value)
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function extractTitle(html) {
  const match = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return cleanText(match?.[1] || "");
}

function extractMetaDescription(html) {
  const text = String(html || "");

  const direct = text.match(/<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i);
  if (direct?.[1]) return cleanText(direct[1]);

  const reverse = text.match(/<meta\s+[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i);
  if (reverse?.[1]) return cleanText(reverse[1]);

  return "";
}

function extractHeadings(html, tagName) {
  const results = [];
  const re = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "gi");
  let match;

  while ((match = re.exec(String(html || ""))) !== null) {
    const value = cleanText(match[1]);
    if (value) results.push(value);
  }

  return results;
}

function extractInternalLinks(html) {
  const links = extractLinks(html);
  return links.filter((href) => {
    const h = href.toLowerCase();
    return (
      h.endsWith(".html") ||
      h.startsWith("#") ||
      h.startsWith("/") ||
      h.startsWith("https://shonshonchan.github.io/seo-pages/")
    );
  });
}

function extractExternalLinks(html) {
  const links = extractLinks(html);
  return links.filter((href) => {
    const h = href.toLowerCase();
    return h.startsWith("http") && !h.startsWith("https://shonshonchan.github.io/seo-pages/");
  });
}

function extractLinks(html) {
  const links = [];
  const re = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let match;

  while ((match = re.exec(String(html || ""))) !== null) {
    if (match[1]) links.push(match[1]);
  }

  return links;
}

function analyzeImages(html) {
  const images = String(html || "").match(/<img\b[^>]*>/gi) || [];
  let missingAlt = 0;

  for (const img of images) {
    const altMatch = img.match(/\salt=["']([^"']*)["']/i);
    if (!altMatch || !String(altMatch[1] || "").trim()) {
      missingAlt += 1;
    }
  }

  return { total: images.length, missingAlt };
}

function findDangerExpressions(html) {
  const text = cleanText(stripTags(String(html || "")));
  const terms = [
    "必ず勝てる",
    "絶対勝てる",
    "確実に勝てる",
    "確実に稼げる",
    "必ず稼げる",
    "勝利保証",
    "出金保証",
    "損失回収",
    "取り返せる",
    "負けを取り戻す",
    "一攫千金"
  ];

  const matches = [];

  for (const term of terms) {
    const count = countOccurrences(text, term);
    if (count > 0) matches.push({ term, count });
  }

  return matches;
}

function countOccurrences(text, term) {
  if (!term) return 0;
  return String(text || "").split(term).length - 1;
}

function cleanText(value) {
  return decodeHtmlEntities(stripTags(String(value || "")))
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value) {
  return String(value || "").replace(/<[^>]*>/g, " ");
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function uniqueList(items) {
  return Array.from(new Set(items.filter(Boolean)));
}

async function githubReadFile(env, path) {
  try {
    const owner = env.GITHUB_OWNER;
    const repo = env.GITHUB_REPO;
    const branch = env.GITHUB_BRANCH || "main";

    if (!owner) return { ok: false, error: "GITHUB_OWNER が設定されていません" };
    if (!repo) return { ok: false, error: "GITHUB_REPO が設定されていません" };
    if (!env.GITHUB_TOKEN) return { ok: false, error: "GITHUB_TOKEN が設定されていません" };

    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
        "Accept": "application/vnd.github+json",
        "User-Agent": "seo-pages-cloudflare-bot"
      }
    });

    if (!res.ok) {
      const errorText = await res.text();
      return { ok: false, error: `GitHub API error: ${res.status}\n${errorText}` };
    }

    const data = await res.json();

    if (!data.content) {
      return { ok: false, error: "GitHub APIからcontentが返ってきませんでした" };
    }

    const binary = atob(String(data.content).replace(/\n/g, ""));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const content = new TextDecoder("utf-8").decode(bytes);

    return { ok: true, content, sha: data.sha };
  } catch (error) {
    return { ok: false, error: String(error && error.message ? error.message : error) };
  }
}

async function githubWriteFile(env, path, content, sha, message) {
  try {
    const owner = env.GITHUB_OWNER;
    const repo = env.GITHUB_REPO;
    const branch = env.GITHUB_BRANCH || "main";

    if (!owner) return { ok: false, error: "GITHUB_OWNER が設定されていません" };
    if (!repo) return { ok: false, error: "GITHUB_REPO が設定されていません" };
    if (!env.GITHUB_TOKEN) return { ok: false, error: "GITHUB_TOKEN が設定されていません" };
    if (!sha) return { ok: false, error: "更新に必要なshaがありません。先にgithub diffを実行してください。" };

    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;

    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "seo-pages-cloudflare-bot"
      },
      body: JSON.stringify({
        message,
        content: base64EncodeUtf8(content),
        sha,
        branch
      })
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return {
        ok: false,
        error: `GitHub write error: ${res.status}\n${JSON.stringify(data)}`
      };
    }

    return {
      ok: true,
      commitSha: data?.commit?.sha || "",
      commitUrl: data?.commit?.html_url || ""
    };
  } catch (error) {
    return { ok: false, error: String(error && error.message ? error.message : error) };
  }
}

function base64EncodeUtf8(value) {
  const bytes = new TextEncoder().encode(String(value || ""));
  let binary = "";

  for (let i = 0; i < bytes.length; i += 0x8000) {
    const chunk = bytes.subarray(i, i + 0x8000);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

async function safeGetJson(kv, key, fallback) {
  try {
    const raw = await kv.get(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

function detectModeFromText(text) {
  const t = (text || "").toLowerCase();

  const devKeywords = [
    "cloudflare", "worker", "workers", "telegram", "botfather", "webhook",
    "api", "anthropic", "claude", "token", "secret", "kv", "binding",
    "deploy", "debug", "error", "javascript",
    "コード", "実装", "デバッグ", "エラー", "トークン",
    "シークレット", "バインディング", "デプロイ"
  ];

  const seoKeywords = [
    "seo", "記事", "構成", "見出し", "キーワード", "kw", "検索意図",
    "内部リンク", "リライト", "タイトル案", "ディスクリプション",
    "競合", "順位", "流入", "ctr", "h1", "h2", "h3",
    "記事設計", "メタタイトル", "メタディスクリプション",
    "比較軸", "更新方針", "運用改善", "serp",
    "オンラインカジノ", "igaming", "betting", "gambling"
  ];

  const devScore = devKeywords.reduce((score, keyword) => score + (t.includes(keyword) ? 1 : 0), 0);
  const seoScore = seoKeywords.reduce((score, keyword) => score + (t.includes(keyword) ? 1 : 0), 0);

  if (devScore > seoScore && devScore > 0) return "dev";
  if (seoScore > devScore && seoScore > 0) return "seo";
  if (devScore > 0 && seoScore > 0) return "chat";
  return "chat";
}

function inferTaskState(text, effectiveMode, previousTaskState) {
  const t = (text || "").toLowerCase();

  const nextState = {
    mode: effectiveMode,
    topic: text.slice(0, 160),
    taskType: "general",
    stage: "in_progress",
    nextActions: [],
    updatedAt: new Date().toISOString()
  };

  if (effectiveMode === "dev") {
    nextState.taskType = "development_support";

    if (t.includes("エラー") || t.includes("error") || t.includes("不具合")) {
      nextState.stage = "debugging";
      nextState.nextActions = ["エラー原因の切り分け", "再現条件の確認", "修正方針の決定"];
    } else if (t.includes("実装") || t.includes("コード") || t.includes("追加")) {
      nextState.stage = "implementation";
      nextState.nextActions = ["変更箇所の特定", "実装方針の整理", "テスト手順の確認"];
    } else {
      nextState.stage = "discussion";
      nextState.nextActions = ["論点整理", "優先順位確認", "次の一手決定"];
    }
  }

  if (effectiveMode === "seo") {
    nextState.taskType = "seo_support";

    if (t.includes("構成") || t.includes("見出し")) {
      nextState.stage = "outline";
      nextState.nextActions = ["検索意図の整理", "記事タイプ決定", "見出し設計"];
    } else if (t.includes("競合") || t.includes("serp") || t.includes("上位")) {
      nextState.stage = "research";
      nextState.nextActions = ["競合傾向確認", "SERP傾向整理", "構成へ反映"];
    } else if (t.includes("リライト")) {
      nextState.stage = "rewrite";
      nextState.nextActions = ["改善点抽出", "リライト方針整理", "修正版作成"];
    } else {
      nextState.stage = "planning";
      nextState.nextActions = ["テーマ整理", "検索意図整理", "優先アクション決定"];
    }
  }

  if (effectiveMode === "chat") {
    nextState.taskType = "general_support";
    nextState.stage = "discussion";
    nextState.nextActions = ["状況整理", "論点明確化", "次の一手決定"];
  }

  if (text.trim().length < 6 && previousTaskState) {
    return {
      ...previousTaskState,
      topic: text.trim() || previousTaskState.topic,
      updatedAt: new Date().toISOString()
    };
  }

  return nextState;
}

function updateMemoryState(text, effectiveMode, previousMemoryState) {
  const base = previousMemoryState || {
    goal: "",
    project: "",
    preferences: [],
    notes: [],
    updatedAt: ""
  };

  const next = {
    ...base,
    preferences: Array.isArray(base.preferences) ? [...base.preferences] : [],
    notes: Array.isArray(base.notes) ? [...base.notes] : []
  };

  const trimmed = text.trim();

  if (
    trimmed.length >= 20 &&
    (
      /僕の目的|私の目的|目的を共有|最終的にやりたい|最終目的|目標|作りたい|実現したい|目指して/.test(trimmed) ||
      /Telegram bot.*Cloudflare Workers.*Claude API/.test(trimmed) ||
      /合法地域向け.*SEOサイト/.test(trimmed)
    )
  ) {
    next.goal = trimmed.slice(0, 600);
  }

  if (
    trimmed.length >= 20 &&
    /SEOサイト|Telegram bot|Cloudflare Workers|Claude API|オンラインカジノ|自動化|運用支援/.test(trimmed)
  ) {
    next.project = trimmed.slice(0, 600);
  }

  if (/分割送信|即レス|すぐ返す|長文でも|検索機能|記憶機能|文脈保持|実務向け/.test(trimmed)) {
    pushUnique(next.preferences, trimmed.slice(0, 180), 12);
  }

  if (trimmed.length >= 20 && /大事|必須|必要|前提|注意|覚えて|求めている/.test(trimmed)) {
    pushUnique(next.notes, trimmed.slice(0, 220), 15);
  }

  next.updatedAt = new Date().toISOString();
  return next;
}

function pushUnique(arr, value, maxItems) {
  if (!arr.includes(value)) arr.unshift(value);
  while (arr.length > maxItems) arr.pop();
}

function isMemoryQuestion(text) {
  const t = (text || "").toLowerCase();
  return (
    t.includes("覚えて") ||
    t.includes("記憶") ||
    t.includes("僕の目的") ||
    t.includes("私の目的") ||
    t.includes("何を目指してた") ||
    t.includes("何作ってる")
  );
}

function buildMemoryAnswer(memoryState) {
  if (!memoryState || (!memoryState.goal && !memoryState.project)) {
    return [
      "今の保存記憶では、目的はまだ十分に固まってへんで。",
      "",
      "必要ならもう一回、目的をそのまま送ってくれたら保存し直すで。"
    ].join("\n");
  }

  const lines = [];
  lines.push("今の保存記憶から言うと👇");
  lines.push("");

  if (memoryState.goal) {
    lines.push("【目的】");
    lines.push(memoryState.goal);
    lines.push("");
  }

  if (memoryState.project) {
    lines.push("【プロジェクト】");
    lines.push(memoryState.project);
    lines.push("");
  }

  if (Array.isArray(memoryState.preferences) && memoryState.preferences.length > 0) {
    lines.push("【好み・要件】");
    for (const p of memoryState.preferences.slice(0, 6)) {
      lines.push(`- ${p}`);
    }
    lines.push("");
  }

  if (Array.isArray(memoryState.notes) && memoryState.notes.length > 0) {
    lines.push("【補足メモ】");
    for (const n of memoryState.notes.slice(0, 5)) {
      lines.push(`- ${n}`);
    }
  }

  return lines.join("\n");
}

function buildMemoryStatusText(memoryState) {
  if (!memoryState) {
    return "記憶状態👇\n\nまだ保存された目的メモはないで。";
  }

  const lines = [];
  lines.push("記憶状態👇");
  lines.push("");
  lines.push(`goal: ${memoryState.goal || "-"}`);
  lines.push(`project: ${memoryState.project || "-"}`);

  if (Array.isArray(memoryState.preferences) && memoryState.preferences.length > 0) {
    lines.push("preferences:");
    for (const p of memoryState.preferences.slice(0, 6)) {
      lines.push(`- ${p}`);
    }
  }

  if (memoryState.updatedAt) {
    lines.push(`updatedAt: ${memoryState.updatedAt}`);
  }

  return lines.join("\n");
}

function shouldUseWebSearch(text, effectiveMode) {
  const t = (text || "").toLowerCase();

  const explicitKeywords = [
    "最新",
    "調べて",
    "検索して",
    "リサーチ",
    "ニュース",
    "今の",
    "リアルタイム",
    "競合調査",
    "serp",
    "上位サイト",
    "順位"
  ];

  if (explicitKeywords.some((k) => t.includes(k.toLowerCase()))) return true;

  if (effectiveMode === "seo" && (t.includes("競合") || t.includes("serp") || t.includes("上位"))) {
    return true;
  }

  return false;
}

function buildStatusText(currentMode, taskState) {
  const lines = [];
  lines.push("現在の状態やで👇");
  lines.push("");
  lines.push(`mode: ${currentMode}`);

  if (!taskState) {
    lines.push("task: まだ保存されてへん");
    return lines.join("\n");
  }

  lines.push(`taskType: ${taskState.taskType || "-"}`);
  lines.push(`stage: ${taskState.stage || "-"}`);
  lines.push(`topic: ${taskState.topic || "-"}`);

  if (Array.isArray(taskState.nextActions) && taskState.nextActions.length > 0) {
    lines.push("nextActions:");
    for (const action of taskState.nextActions) {
      lines.push(`- ${action}`);
    }
  }

  lines.push(`updatedAt: ${taskState.updatedAt || "-"}`);
  return lines.join("\n");
}

function buildSystemPrompt(effectiveMode, currentMode, taskState, memoryState) {
  const basePrompt = `
あなたはTelegram上で動作する、管理者専用のAIアシスタントです。
返答は必ず日本語で行ってください。
会話スタイルは親しみやすくて明るめでOKですが、中身は常に論理的・実務的にしてください。
法令順守とコンプライアンスを前提に情報整理と運用支援を行ってください。
違法行為の支援、法令回避、規制回避、脱法的な助言は行ってはいけません。

返答は、できる限り次の順番で整理してください。
1. 結論
2. 理由
3. 今やること
4. 次の一手

できるだけ実務で使える形で、構造化して返してください。
`.trim();

  const autoNote =
    currentMode === "auto"
      ? `現在は auto モードです。今回の入力内容から、今回の処理は ${effectiveMode} モード相当として扱ってください。`
      : "";

  const taskNote = taskState
    ? `
現在の内部タスク状態:
- taskType: ${taskState.taskType || "-"}
- stage: ${taskState.stage || "-"}
- topic: ${taskState.topic || "-"}
- nextActions: ${(taskState.nextActions || []).join(" / ") || "-"}
`
    : "";

  const memoryNote = memoryState
    ? `
保存済み記憶:
- goal: ${memoryState.goal || "-"}
- project: ${memoryState.project || "-"}
- preferences: ${(memoryState.preferences || []).join(" / ") || "-"}
- notes: ${(memoryState.notes || []).join(" / ") || "-"}
この記憶を会話に反映してください。
`
    : "";

  const modePrompts = {
    chat: "現在は chat モードです。幅広い相談、整理、壁打ちを支援してください。",
    dev: "現在は dev モードです。Cloudflare Workers、Telegram bot、Claude API、実装・デバッグを優先して支援してください。",
    seo: "現在は seo モードです。SEO設計、記事構成、運用改善を優先してください。検索系依頼なら必要に応じて最新情報を反映してください。"
  };

  return `${basePrompt}\n\n${autoNote}\n\n${taskNote}\n\n${memoryNote}\n\n${modePrompts[effectiveMode] || modePrompts.chat}`;
}

async function runClaudeSimple(env, systemPrompt, messages, timeoutMs, maxTokens = 1200, useWebSearch = false) {
  try {
    return await Promise.race([
      callClaudeTextWithContinuation(env, systemPrompt, messages, maxTokens, useWebSearch),
      new Promise((resolve) =>
        setTimeout(() => resolve({ ok: false, timedOut: true, replyText: "" }), timeoutMs)
      )
    ]);
  } catch (error) {
    return {
      ok: false,
      timedOut: false,
      replyText: `Claude呼び出しエラー: ${error.message}`
    };
  }
}

async function callClaudeTextWithContinuation(env, systemPrompt, messages, maxTokens = 1200, useWebSearch = false) {
  async function requestClaude(inputMessages, enableWebSearch) {
    const payload = {
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: inputMessages
    };

    if (enableWebSearch) {
      payload.tools = [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 1
        }
      ];
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    return { response, data };
  }

  let workingMessages = [...messages];
  let finalText = "";
  let continuationCount = 0;
  const maxContinuations = 3;

  while (continuationCount <= maxContinuations) {
    let { response, data } = await requestClaude(
      workingMessages,
      useWebSearch && continuationCount === 0
    );

    if (!response.ok && useWebSearch && continuationCount === 0) {
      ({ response, data } = await requestClaude(workingMessages, false));

      if (!response.ok) {
        return { ok: false, replyText: `Anthropic error: ${JSON.stringify(data)}` };
      }
    } else if (!response.ok) {
      return { ok: false, replyText: `Anthropic error: ${JSON.stringify(data)}` };
    }

    const content = Array.isArray(data.content) ? data.content : [];
    const textPart = extractTextOnly(content) || "";

    if (textPart) finalText += (finalText ? "\n" : "") + textPart;

    const stopReason = data?.stop_reason || "";

    if (stopReason !== "max_tokens") {
      return { ok: true, replyText: finalText || "返答を取得できませんでした。" };
    }

    continuationCount += 1;

    if (continuationCount > maxContinuations) {
      return {
        ok: true,
        replyText:
          (finalText || "返答を取得できませんでした。") +
          "\n\n※かなり長文だったため、ここで一旦区切ってるで。必要なら『続きを出して』で続けられる。"
      };
    }

    workingMessages.push({ role: "assistant", content });
    workingMessages.push({
      role: "user",
      content: "今の回答の続きを、重複なしでそのまま続けてください。最初から繰り返さず、途中から自然につないでください。"
    });

    workingMessages = workingMessages.slice(-12);
  }

  return { ok: true, replyText: finalText || "返答を取得できませんでした。" };
}

function extractTextOnly(content) {
  if (!Array.isArray(content)) return "";

  return content
    .filter((block) => block?.type === "text" && typeof block?.text === "string")
    .map((block) => block.text)
    .join("\n");
}

async function sendTelegramMessage(env, chatId, text) {
  const chunks = splitMessageForTelegram(text, 3000);

  for (let i = 0; i < chunks.length; i++) {
    const prefix = chunks.length > 1 ? `(${i + 1}/${chunks.length})\n` : "";
    const body = {
      chat_id: chatId,
      text: prefix + chunks[i]
    };

    const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const description = data?.description || "";

      if (description.includes("message is too long")) {
        const retryChunks = splitMessageForTelegram(chunks[i], 1500);

        for (let j = 0; j < retryChunks.length; j++) {
          const retryPrefix =
            chunks.length > 1 || retryChunks.length > 1 ? `(${i + 1}.${j + 1})\n` : "";

          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: retryPrefix + retryChunks[j]
            })
          });
        }

        continue;
      }

      throw new Error(`Telegram sendMessage error: ${description || response.status}`);
    }
  }
}

async function sendLongTelegramMessage(env, chatId, text) {
  await sendTelegramMessage(env, chatId, text);
}

function splitMessageForTelegram(text, maxLength = 3000) {
  const safeText = String(text || "");

  if (safeText.length <= maxLength) return [safeText];

  const chunks = [];
  let remaining = safeText;

  while (remaining.length > maxLength) {
    let splitIndex = remaining.lastIndexOf("\n\n", maxLength);

    if (splitIndex < maxLength * 0.5) splitIndex = remaining.lastIndexOf("\n", maxLength);

    if (splitIndex < maxLength * 0.5) {
      splitIndex = Math.max(
        remaining.lastIndexOf("。", maxLength),
        remaining.lastIndexOf(".", maxLength),
        remaining.lastIndexOf("！", maxLength),
        remaining.lastIndexOf("?", maxLength),
        remaining.lastIndexOf("？", maxLength)
      );
    }

    if (splitIndex < maxLength * 0.5) splitIndex = remaining.lastIndexOf(" ", maxLength);
    if (splitIndex < maxLength * 0.5) splitIndex = maxLength;

    const chunk = remaining.slice(0, splitIndex).trim();
    if (chunk) chunks.push(chunk);

    remaining = remaining.slice(splitIndex).trim();
  }

  if (remaining) chunks.push(remaining);

  return chunks;
}