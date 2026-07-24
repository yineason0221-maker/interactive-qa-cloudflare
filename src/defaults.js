export const DEFAULT_ADMIN_PASSWORD = 'admin';

export const DEFAULT_SETTINGS = {
  site_title: '神秘互動問答',
  bgm_url: '',
  bgm_timeline: '[]',
  force_fullscreen: 'true'
};

export const DEFAULT_STEPS = [
  {
    order_index: 0,
    type: 'subtitle',
    title: '歡迎語',
    content: {
      text: '歡迎來到這段特別的問答旅程...',
      duration: 3,
      fadeIn: 1,
      fadeOut: 1,
      textSize: 'large'
    }
  },
  {
    order_index: 1,
    type: 'subtitle',
    title: '前導說明',
    content: {
      text: '請跟隨你的直覺，回答接下來的每一個問題。',
      duration: 4,
      fadeIn: 0.8,
      fadeOut: 0.8,
      textSize: 'medium'
    }
  },
  {
    order_index: 2,
    type: 'effect',
    title: '震撼登場',
    content: {
      effectType: 'matrix',
      duration: 3,
      soundEffect: ''
    }
  },
  {
    order_index: 3,
    type: 'question',
    title: '基礎暱稱',
    content: {
      questionText: '首先，請告诉我你的名字或暱稱：',
      questionType: 'text',
      options: [],
      required: true
    }
  },
  {
    order_index: 4,
    type: 'question',
    title: '心情指數',
    content: {
      questionText: '今天的心情如何？滿分 10 分你給幾分？',
      questionType: 'rating',
      options: [],
      required: true
    }
  },
  {
    order_index: 5,
    type: 'question',
    title: '特別喜好',
    content: {
      questionText: '如果可以擁有一個超能力，你最想選擇哪一個？',
      questionType: 'single_choice',
      options: ['瞬間移動', '讀心術', '預知未來', '時間暫停', '隱形能力'],
      required: true
    }
  },
  {
    order_index: 6,
    type: 'effect',
    title: '絢麗煙火慶祝',
    content: {
      effectType: 'fireworks',
      duration: 4
    }
  },
  {
    order_index: 7,
    type: 'question',
    title: '衷心祝福與真心話',
    content: {
      questionText: '最後，有什麼想對我說的話嗎？（任意長度）',
      questionType: 'text',
      options: [],
      required: false
    }
  },
  {
    order_index: 8,
    type: 'subtitle',
    title: '感謝尾聲',
    content: {
      text: '感謝你的認真回答，我們的故事才剛剛開始！',
      duration: 5,
      fadeIn: 1,
      fadeOut: 1,
      textSize: 'large'
    }
  }
];
