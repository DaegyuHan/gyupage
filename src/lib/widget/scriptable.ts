/**
 * 아이폰 Scriptable 앱에 붙여 넣을 위젯 스크립트를 만들어 줌 (주소·토큰을 채워서)
 * 홈 화면(소·중·대)과 잠금 화면 위젯 모두 지원.
 */
export function buildWidgetScript(origin: string, token: string) {
  return `// 규페이지 · 오늘 꼭 할 일 위젯 (Scriptable)
// 홈 화면/잠금 화면에 Scriptable 위젯을 추가하고 이 스크립트를 고르면 돼요.
// 할 일은 규페이지에서 적고 체크해요. 위젯은 15분쯤마다 새로 읽어요.

const SITE = ${JSON.stringify(origin)};
const TOKEN = ${JSON.stringify(token)};

const C = {
  bgTop: new Color("#1b2540"),
  bgBottom: new Color("#141c2b"),
  ink: new Color("#e8ecf3"),
  dim: new Color("#8a94a6"),
  accent: new Color("#7d95ff"),
  done: new Color("#3cc99a"),
};

async function load() {
  const req = new Request(SITE + "/api/widget/todos");
  req.headers = { Authorization: "Bearer " + TOKEN };
  req.timeoutInterval = 15;
  const j = await req.loadJSON();
  if (req.response.statusCode !== 200) throw new Error(j.error || "불러오지 못했어요");
  return j;
}

function base() {
  const w = new ListWidget();
  const g = new LinearGradient();
  g.colors = [C.bgTop, C.bgBottom];
  g.locations = [0, 1];
  w.backgroundGradient = g;
  w.url = SITE + "/";
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
  return w;
}

function header(w, data, size) {
  const row = w.addStack();
  row.centerAlignContent();
  const t = row.addText(size === "small" ? "오늘 할 일" : "오늘 꼭 할 일");
  t.font = Font.boldSystemFont(size === "small" ? 13 : 14);
  t.textColor = C.ink;
  row.addSpacer(4);
  const dot = row.addText("●");
  dot.font = Font.systemFont(7);
  dot.textColor = C.accent;
  row.addSpacer();
  if (data && data.total > 0) {
    const n = row.addText(data.done + "/" + data.total);
    n.font = Font.boldRoundedSystemFont(13);
    n.textColor = data.done === data.total ? C.done : C.accent;
  }
  if (size !== "small" && data) {
    const d = w.addText(data.label);
    d.font = Font.systemFont(11);
    d.textColor = C.dim;
  }
}

function item(w, todo, fontSize) {
  const row = w.addStack();
  row.centerAlignContent();
  const sym = SFSymbol.named(todo.done ? "checkmark.square.fill" : "square");
  sym.applyMediumWeight();
  const img = row.addImage(sym.image);
  img.imageSize = new Size(fontSize + 2, fontSize + 2);
  img.tintColor = todo.done ? C.done : C.dim;
  row.addSpacer(6);
  const t = row.addText(todo.text);
  t.font = todo.done ? Font.systemFont(fontSize) : Font.mediumSystemFont(fontSize);
  t.textColor = todo.done ? C.dim : C.ink;
  t.lineLimit = 1;
}

function homeWidget(data, size) {
  const w = base();
  w.setPadding(14, 14, 12, 14);
  header(w, data, size);
  w.addSpacer(size === "small" ? 8 : 10);

  const max = size === "small" ? 3 : size === "medium" ? 4 : 9;
  // 안 한 일을 먼저
  const list = [...data.todos.filter((t) => !t.done), ...data.todos.filter((t) => t.done)];
  if (list.length === 0) {
    const e = w.addText("오늘 할 일이 없어요 ✨\\n규페이지에서 적어 보세요");
    e.font = Font.systemFont(12);
    e.textColor = C.dim;
  } else {
    list.slice(0, max).forEach((t, i) => {
      if (i > 0) w.addSpacer(size === "large" ? 7 : 5);
      item(w, t, size === "small" ? 12 : 13);
    });
    if (list.length > max) {
      w.addSpacer(4);
      const more = w.addText("+" + (list.length - max) + "개 더");
      more.font = Font.systemFont(11);
      more.textColor = C.dim;
    }
  }
  w.addSpacer();
  return w;
}

function lockWidget(data, family) {
  const w = new ListWidget();
  w.url = SITE + "/";
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
  const left = data.todos.filter((t) => !t.done);
  if (family === "accessoryCircular") {
    const t = w.addText(data.total ? data.done + "/" + data.total : "–");
    t.font = Font.boldRoundedSystemFont(16);
    t.centerAlignText();
    const s = w.addText("할 일");
    s.font = Font.systemFont(9);
    s.centerAlignText();
    return w;
  }
  if (family === "accessoryInline") {
    w.addText(data.total ? "할 일 " + data.done + "/" + data.total + (left[0] ? " · " + left[0].text : "") : "오늘 할 일 없음");
    return w;
  }
  const h = w.addText("할 일 " + data.done + "/" + data.total);
  h.font = Font.boldSystemFont(13);
  left.slice(0, 2).forEach((t) => {
    const x = w.addText("· " + t.text);
    x.font = Font.systemFont(12);
    x.lineLimit = 1;
  });
  if (data.total && !left.length) w.addText("다 했어요 🎉").font = Font.systemFont(12);
  return w;
}

let widget;
try {
  const data = await load();
  const family = config.widgetFamily || "medium";
  widget = family.startsWith("accessory") ? lockWidget(data, family) : homeWidget(data, family);
} catch (e) {
  widget = base();
  widget.setPadding(14, 14, 14, 14);
  const t = widget.addText("규페이지에 연결하지 못했어요");
  t.font = Font.mediumSystemFont(12);
  t.textColor = C.ink;
  const m = widget.addText(String(e.message || e));
  m.font = Font.systemFont(10);
  m.textColor = C.dim;
}

if (config.runsInWidget) Script.setWidget(widget);
else await widget.presentMedium();
Script.complete();
`;
}
