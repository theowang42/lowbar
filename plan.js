// 训练计划数据：浏览器与 Node 共用，只放数据，不放逻辑。

// Node 脚本（测试、将来的提醒）计算"今天"时使用的时区。浏览器一律用设备本地时区。
export const TIMEZONE = 'Asia/Shanghai';

// 每个动作的组数
export const SETS = 3;

// 连续多少次训练完成某动作后，目标 +1
export const PROGRESS_AFTER = 3;

// 每个训练日都练这些，按顺序显示（数字键 1–4 对应）
// unit：计量单位；min / max：目标次数的下限与上限；optional：可选动作，不做也不影响打卡
// lift：做一次身体（或上半身）被抬起的大致高度（米），用于累计"爬升"
export const EXERCISES = {
  pull: {
    id: 'pull',
    name: '引体向上',
    unit: '次',
    min: 1,
    max: 20,
    lift: 0.5,
    cue: '双手握杠，弯膝让脚离地，下巴过杠再慢慢放下；拉不动时脚可以点地借力。',
  },
  push: {
    id: 'push',
    name: '俯卧撑',
    unit: '次',
    min: 5,
    max: 40,
    lift: 0.3,
    cue: '身体成一条直线，收紧腹部，胸口接近地面再推起。',
  },
  crunch: {
    id: 'crunch',
    name: '卷腹',
    unit: '次',
    min: 10,
    max: 40,
    lift: 0.15,
    cue: '仰卧屈膝，下背贴地，用腹部把肩膀卷离地面，停 1 秒再放下。',
  },
  squat: {
    id: 'squat',
    name: '深蹲',
    unit: '次',
    min: 10,
    max: 40,
    optional: true,
    lift: 0.4,
    cue: '双脚与肩同宽，臀部向后坐，蹲到大腿与地面平行。',
  },
};

// 下标 = 星期几（0 = 周日）
export const WEEK = ['rest', 'train', 'train', 'train', 'train', 'train', 'train'];

// 休息日的拉伸建议
export const STRETCHES = [
  '挂杠放松：双手挂杠，脚踩地，身体下沉放松肩背，30 秒',
  '扶墙拉胸：手扶门框，身体转向另一侧，每侧 30 秒',
  '站姿前屈：双腿伸直，上身自然下垂，30 秒',
  '婴儿式：跪坐向前趴，放松背部，30 秒',
];

// 累计爬升的一路地标（米），从低到高
export const LANDMARKS = [
  { name: '一层楼', height: 3 },
  { name: '天安门城楼', height: 35 },
  { name: '黄鹤楼', height: 51 },
  { name: '大雁塔', height: 65 },
  { name: '自由女神像', height: 93 },
  { name: '胡夫金字塔', height: 139 },
  { name: '埃菲尔铁塔', height: 330 },
  { name: '东方明珠', height: 468 },
  { name: '上海中心大厦', height: 632 },
  { name: '哈利法塔', height: 828 },
  { name: '泰山之巅', height: 1545 },
  { name: '黄山光明顶', height: 1860 },
  { name: '富士山', height: 3776 },
  { name: '乞力马扎罗', height: 5895 },
  { name: '珠穆朗玛峰', height: 8849 },
];
