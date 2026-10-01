// 训练计划数据：浏览器与 Node 共用，只放数据，不放逻辑。

// Node 脚本（测试、将来的提醒）计算"今天"时使用的时区。浏览器一律用设备本地时区。
export const TIMEZONE = 'Asia/Shanghai';

// 每个动作的组数
export const SETS = 3;

// 连续多少次训练完成某动作后进阶
export const PROGRESS_AFTER = 3;

// unit：计量单位；min / max：目标次数（或秒数）的下限与上限；step：每次进阶增加多少
export const EXERCISES = {
  push: {
    id: 'push',
    name: '推',
    unit: '次',
    min: 8,
    max: 15,
    step: 1,
    levels: [
      { name: '上斜俯卧撑', cue: '双手撑单杠略宽于肩，身体成一条直线，胸口贴近杠再推起。' },
      { name: '标准俯卧撑', cue: '手在肩正下方，收紧腹部和臀部，胸口接近地面再推起。' },
      { name: '窄距俯卧撑', cue: '双手距离小于肩宽，手肘贴着身体向后，下放要慢。' },
    ],
  },
  legs: {
    id: 'legs',
    name: '腿',
    unit: '次',
    min: 10,
    max: 20,
    step: 1,
    levels: [
      { name: '深蹲', cue: '双脚与肩同宽，臀部向后坐，膝盖与脚尖同向，蹲到大腿与地面平行。' },
      { name: '反向弓步', cue: '一脚向后迈，双膝约 90 度，前脚发力站回。', perSide: true },
      { name: '保加利亚分腿蹲', cue: '后脚搭在椅子上，前脚踩稳，垂直下蹲，前膝不内扣。', perSide: true },
    ],
  },
  core: {
    id: 'core',
    name: '平板支撑',
    unit: '秒',
    min: 20,
    max: 60,
    step: 5,
    levels: [
      { name: '平板支撑', cue: '手肘在肩正下方，身体一条直线，不塌腰也不撅臀。' },
    ],
  },
  row: {
    id: 'row',
    name: '划船',
    unit: '次',
    min: 8,
    max: 15,
    step: 1,
    levels: [
      { name: '屈膝澳式划船', cue: '身体斜躺在单杠下方，屈膝踩地，挺胸把胸口拉向杠。' },
      { name: '直腿澳式划船', cue: '双腿伸直脚跟着地，身体保持直线，把胸口拉近杠。' },
      { name: '直腿澳式划船 · 顶端停顿 2 秒', cue: '同直腿划船，拉到顶端夹紧肩胛停 2 秒再慢慢放下。' },
    ],
  },
  pull: {
    id: 'pull',
    name: '引体',
    unit: '次',
    min: 4,
    max: 10,
    step: 1,
    levels: [
      { name: '脚辅助引体', cue: '双手握杠，脚踩地借力，把下巴拉过杠，手臂尽量多出力。' },
      { name: '离心引体', cue: '脚蹬地上到下巴过杠，再用 3–5 秒慢慢放下。' },
      { name: '少借力脚辅助引体', cue: '脚只轻点地面，尽量全靠手臂把下巴拉过杠。' },
    ],
  },
  deadbug: {
    id: 'deadbug',
    name: '死虫',
    unit: '次',
    min: 8,
    max: 15,
    step: 1,
    levels: [
      { name: '死虫', cue: '仰卧，腰贴紧地面，对侧手脚同时慢慢伸远再收回。', perSide: true },
    ],
  },
  bridge: {
    id: 'bridge',
    name: '臀桥',
    unit: '次',
    min: 12,
    max: 20,
    step: 1,
    levels: [
      { name: '臀桥', cue: '仰卧屈膝，脚跟发力抬起臀部，顶端夹紧臀部停 1 秒。' },
    ],
  },
};

export const DAYS = {
  A: { label: 'A 天', focus: '推 + 腿', exercises: ['push', 'legs', 'core'] },
  B: { label: 'B 天', focus: '拉 + 核心', exercises: ['row', 'pull', 'deadbug', 'bridge'] },
};

// 下标 = 星期几（0 = 周日）
export const WEEK = ['rest', 'A', 'B', 'A', 'B', 'A', 'B'];

// 首次引导的测试项：都用等级 1 的动作
export const TESTS = ['push', 'legs', 'row', 'pull', 'core'];

// 休息日的拉伸建议
export const STRETCHES = [
  '挂杠放松：双手挂杠，脚踩地，身体下沉放松肩背，30 秒',
  '站姿前屈：双腿伸直，上身自然下垂，30 秒',
  '弓步压髋：后膝着地，髋部前推，每侧 30 秒',
  '扶墙拉胸：手扶门框，身体转向另一侧，每侧 30 秒',
  '猫牛式：四点跪姿，慢慢弓背、塌腰，10 次',
  '婴儿式：跪坐向前趴，放松背部，30 秒',
];
