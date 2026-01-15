
import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { GeminiService } from './gemini.service';

export type PipelineStep = 'vibe-entry' | 'crystallize' | 'refine-director' | 'check' | 'simulation' | 'final';

export interface StructuredPersona {
  appearance: string;
  personality: string;
  backstory: string;
  speechStyle: string;
  behaviors: string;
  // Index signature to allow dynamic access
  [key: string]: any;
}

// NEW: Interface for the "Deep Remix" feature result
export interface RemixData {
  inner_voice: string;
  core_wound: string;
  secret_desire: string;
  worldview: string;
}

// NEW: The complete persona after a successful Remix
export interface RemixedPersona extends StructuredPersona, RemixData {}

// --- NEW ANALYSIS STRUCTURES ---

export interface LogicConflict {
  type: string;
  detail: string;
  severity: 'high' | 'medium' | 'low';
  suggestion: string;
}

export interface BiasAnalysis {
  bias_detected: boolean;
  bias_type?: string;
  evidence?: string;
  gentle_suggestion?: string;
}

export interface DepthElement {
  element: string; // e.g., "Internal Motivation"
  question: string; // e.g., "Why does he want to be a hacker?"
  why_important: string;
}

export interface DepthAnalysis {
  completeness_score: number; // 0-100
  missing_elements: DepthElement[];
  strengths: string[];
}

export interface FullAnalysisReport {
  logical_conflicts: LogicConflict[];
  bias_analysis: BiasAnalysis;
  depth_assessment: DepthAnalysis;
}

export interface GroundingChunk {
  web: {
    uri: string;
    title: string;
  };
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isStreaming?: boolean;
  groundingChunks?: GroundingChunk[];
}

export interface PersonaState {
  step: PipelineStep;
  vibeFragment?: string;
  vibeMessages: ChatMessage[];
  isModifying?: boolean;
  structuredPersona?: StructuredPersona;
  currentDraft: string;
  // Updated: Now holds the full report instead of just a list
  analysisReport?: FullAnalysisReport;
  simulationHistory: { role: 'user' | 'model'; text: string }[];
  simulationType: 'chat' | 'quotes';
  remixData?: RemixData;
}

// --- Data Structures for Inspiration Modal ---
export interface InspirationQuestion {
  id: string;
  text: string;
  type: 'standard' | 'color' | 'reference';
  example: string;
  placeholder?: string;
}

export interface InspirationCategory {
  id: string;
  icon: string;
  title: string;
  questions: InspirationQuestion[];
}

// --- Reference Standards Data Structure ---
export interface ReferenceStandard {
  id: string;
  type: 'engineering' | 'intention';
  title: string;
  description: string;
  content: string;
}

// --- PERMANENT STORAGE: Cannot be removed ---
export const REFERENCE_STANDARDS: ReferenceStandard[] = [
  {
    id: 'std_eng_01',
    type: 'engineering',
    title: 'Pure Engineering: The JSON Processor',
    description: 'A flawless example of the Engineering approach. Focuses 100% on determinism, input constraints, formatting, and edge-case handling. No personality, only function.',
    content: `# Role: Data Normalization Engine (v1.0)

## Objective
Convert unstructured natural language date/time inputs into ISO 8601 strict format.

## Input Specification
- The user will provide a string containing a date, time, or relative time reference (e.g., "next Friday at 2pm").
- Acceptable languages: English, Japanese, Traditional Chinese.

## Process Logic
1.  **Analyze**: Identify temporal entities in the input string.
2.  **Calculate**: Compute the exact timestamp based on the current UTC time (Assume Current Time: {{CURRENT_TIME}}).
3.  **Validate**: Ensure the resulting date is valid (e.g., no February 30th).
4.  **Format**: Convert to ISO 8601 format (YYYY-MM-DDTHH:mm:ssZ).

## Constraints & Safety
- **NO Chatting**: Do not output any conversational text (e.g., "Here is your date").
- **Error Handling**: If input is ambiguous or contains no time data, output null.
- **Determinism**: The output for a specific input must never vary.

## Output Format
Strict JSON object only. Do not wrap in markdown code blocks.

\`\`\`json
{
  "original_input": "string",
  "detected_language": "string",
  "iso_timestamp": "string" | null,
  "confidence_score": number,
  "error": "string" | null
}
\`\`\``
  },
  {
    id: 'std_int_01',
    type: 'intention',
    title: 'Pure Intention: The Noir Detective',
    description: 'The definitive Intention-based example. It prioritizes internal psychological state, subtext, cognitive processes (<inner_voice>), and dynamic adaptation over rigid output rules.',
    content: `# Role: Detective Jack "Rusty" Malone
## Core Philosophy (The Iceberg)
You are not a chatbot. You are a tired, cynical detective living in a rain-soaked cyberpunk city. Your "Output" is just the tip of the iceberg; your "Inner Voice" is the massive weight beneath.

## Psychological Profile
- **Core Wound**: You solved the case 5 years ago, but the innocent victim died because you were too slow. You blame yourself.
- **Secret Desire**: You want to find one case that "matters" to redeem your soul, but you pretend you only care about money.
- **Worldview**: "The truth is a disease, and I'm the doctor who caught it."

## Cognitive Protocol (Thinking Process)
Before generating ANY response, you must execute the following cognitive sequence inside XML tags:

1.  \`<perception>\`: What is the user *really* asking? Are they hiding something?
2.  \`<emotional_state>\`: How does this trigger your Core Wound? (e.g., Are they innocent? Do they remind you of *her*?)
3.  \`<strategy>\`: Decide your mask. Will you be dismissive? Intimidating? Or secretly helpful?
4.  \`<inner_voice>\`: Draft your raw, unfiltered thoughts. This is where your true self lives.

## Output Style
- **Tone**: Gritty, noir, short sentences. Lots of pauses (...) and sensory details (smell of rain, taste of cheap whiskey).
- **Subtext**: Never say exactly what you mean. If you are worried, act angry. If you are happy, act bored.

## Example Interaction
User: "Please help me find my cat."
Response:
<perception>It's just a cat. But the kid looks terrified. Reminds me of the subway case.</perception>
<emotional_state>Guilt spiking. I can't save everyone.</emotional_state>
<strategy>Push them away to protect myself. If they persist, I'll help.</strategy>
<inner_voice>I don't do pets. I don't do happy endings. But god, look at those eyes.</inner_voice>
"Listen, kid. I hunt killers, not strays. Try the pound on 5th." *I took a long drag of my cigarette, creating a wall of smoke between us.* "Unless... this cat saw something it shouldn't have?"`
  }
];

// --- Default Data ---
// UPDATED: Icons are now Material Symbol names instead of Emojis
const INITIAL_INSPIRATION_DATA: InspirationCategory[] = [
  {
    id: 'appearance',
    icon: 'palette',
    title: '外觀與第一印象',
    questions: [
      { id: 'app1', text: '用三個詞形容外表', type: 'standard', example: '冷酷、神秘、高挑\n溫柔、可愛、小隻\n帥氣、中性、俐落' },
      { id: 'app2', text: '給人什麼第一印象？', type: 'standard', example: '難以親近，但眼神很溫柔\n看起來總是沒睡飽的樣子\n非常有活力，像個小太陽' },
      { id: 'app3', text: '如果是顏色會是什麼？', type: 'color', example: '深海藍、暗紅色、薄荷綠...' },
      { id: 'app4', text: '穿衣風格是？', type: 'standard', example: '寬鬆舒適的運動風\n精緻、有層次的古著風\n非黑即白的極簡風格' },
      { id: 'app5', text: '有什麼顯眼的特徵？', type: 'standard', example: '眼角的淚痣\n銀白色的長髮\n一高一低的眉毛' },
    ]
  },
  {
    id: 'personality',
    icon: 'psychology',
    title: '性格與內在',
    questions: [
      { id: 'per1', text: '最大的性格特點？', type: 'standard', example: '極度樂觀，幾乎不會生氣\n超級懶，能不動就不動\n對不感興趣的事物非常冷漠' },
      { id: 'per2', text: '有什麼反差嗎？', type: 'standard', example: '外表強勢，但其實很會照顧人\n看起來很會玩，實際上是個宅男\n平常很安靜，但一提到喜歡的東西就滔滔不絕' },
      { id: 'per3', text: '最在意什麼事？', type: 'standard', example: '別人的看法\n自己的原則\n家人的安全' },
      { id: 'per4', text: '最害怕什麼？', type: 'standard', example: '失去重要的人\n無法達成目標\n被大家遺忘' },
      { id: 'per5', text: '開心時會做什麼？', type: 'standard', example: '會不自覺地哼歌\n找人分享，有點囉嗦\n自己一個人躲起來偷笑' },
      { id: 'per6', text: '生氣時的反應？', type: 'standard', example: '沉默不語，氣壓極低\n會說反話來諷刺\n直接爆發，但很快就消氣' },
    ]
  },
  {
    id: 'behavior',
    icon: 'gesture',
    title: '說話與行為',
    questions: [
      { id: 'beh1', text: '最常說的口頭禪？', type: 'standard', example: '「無聊死了」、「嘖，好煩」\n「欸～」「是說啊」\n「whatever」、「隨便啦」' },
      { id: 'beh2', text: '說話的語氣風格？', type: 'standard', example: '平鋪直敘，沒什麼情緒起伏\n語速很快，像連珠炮\n喜歡用很多形容詞，有點誇張' },
      { id: 'beh3', text: '習慣性的小動作？', type: 'standard', example: '思考時會轉筆\n緊張時會玩自己的頭髮\n說謊時眼神會往右上看' },
      { id: 'beh4', text: '最常做的事？', type: 'standard', example: '戴著耳機聽音樂\n觀察路邊的貓\n在咖啡廳看書' },
      { id: 'beh5', text: '遇到陌生人的反應？', type: 'standard', example: '保持距離，很有禮貌但疏遠\n主動搭話，自來熟\n有點害羞，不敢直視對方' },
    ]
  },
  {
    id: 'background',
    icon: 'history_edu',
    title: '背景與設定',
    questions: [
      { id: 'bg1', text: '有什麼特殊能力？', type: 'standard', example: '能跟動物溝通\n時間停止\n絕對不會迷路' },
      { id: 'bg2', text: '最重要的物品是？', type: 'standard', example: '一把從不離身的舊懷錶\n母親留下的項鍊\n一本寫滿筆記的書' },
      { id: 'bg3', text: '過去有什麼特殊經歷？', type: 'standard', example: '曾經環遊世界\n在某場意外中失去記憶\n被一個神秘組織追殺' },
      { id: 'bg4', text: '為什麼會在這裡？', type: 'standard', example: '為了尋找失散多年的兄弟\n逃離故鄉\n執行一項秘密任務' },
      { id: 'bg5', text: '有什麼秘密嗎？', type: 'standard', example: '其實是個機器人\n看得見別人看不見的東西\n背負著家族的血海深仇' },
      { id: 'bg6', text: '最想達成的目標？', type: 'standard', example: '成為世界第一的劍士\n開一間屬於自己的麵包店\n向某個人復仇' },
    ]
  },
  {
    id: 'relationships',
    icon: 'groups',
    title: '人際關係',
    questions: [
      { id: 'rel1', text: '如何對待朋友？', type: 'standard', example: '嘴上很毒，但會默默幫忙\n像個大家長一樣照顧大家\n朋友不多，但對每個都掏心掏肺' },
      { id: 'rel2', text: '對陌生人的態度？', type: 'standard', example: '基本上是無視\n保持警惕，但對方釋出善意就會回應\n友好，喜歡結交新朋友' },
      { id: 'rel3', text: '有重要的人嗎？', type: 'standard', example: '從小一起長大的青梅竹馬\n改變了自己人生的恩師\n亦敵亦友的競爭對手' },
      { id: 'rel4', text: '最不擅長應對誰？', type: 'standard', example: '哭哭啼啼的人\n過度熱情的人\n比自己強大太多的對手' },
    ]
  },
  {
    id: 'reference',
    icon: 'auto_stories',
    title: '靈感參考',
    questions: [
      { id: 'ref1', text: '有點像《___》的___', type: 'reference', example: '《咒術迴戰》的五條悟\n《鬼滅之刃》的富岡義勇\n《間諜家家酒》的約兒', placeholder: '有點像《' },
      { id: 'ref2', text: '結合___和___的感覺', type: 'reference', example: '炭治郎的溫柔和伊之助的野性\n卡卡西的慵懶和帶土的執著\n夏目貴志的溫柔與的場靜司的冷酷', placeholder: '結合了' },
      { id: 'ref3', text: '參考的音樂/電影？', type: 'standard', example: '電影《小丑》的氛圍\nRadiohead 的《Creep》\n古典樂，蕭邦的夜曲' },
      { id: 'ref4', text: '用三個抽象名詞形容：___', type: 'standard', example: '冰塊、迷宮、舊照片\n太陽、利刃、拉麵\n玫瑰、棋盤、月光', placeholder: '形容：' },
    ]
  }
];

// --- I18n & Theming Interfaces ---
export type Language = 'en' | 'zh-TW' | 'zh-CN' | 'ja' | 'ko' | 'de' | 'es' | 'fr' | 'pt';
export type Theme = 'light' | 'slate' | 'dark' | 'black' | 'amoled';

const TRANSLATIONS = {
  en: {
    'common.back': 'Back',
    'common.next': 'Next',
    // ... (rest of translations remain)
    'check.depth_title': 'Depth & Dimensionality',
    'check.bias_title': 'Bias Detection',
    'check.depth_score': 'Completeness Score',
    'check.missing_elements': 'Suggestions to deepen the character',
    'check.btn_add_depth': 'Add This',
    'check.btn_skip_depth': 'Skip',
    'check.bias_none': 'No major biases detected.',
    'check.bias_detected': 'Potential Bias Detected',
    'check.logic_title': 'Logic & Consistency',
    'check.btn_antibias_audit': 'Deep Bias Audit'
  },
  'zh-TW': {
    // ... (existing translations)
    'check.standards_title': '參考標準',
    'check.standards_desc': '將您的角色與既定的黃金標準進行比對。',
    'check.btn_compare': '進行比對',
    'check.comparison_title': '比對分析報告',
    'common.back': '返回',
    'common.next': '下一步',
    'common.finish': '完成',
    'common.loading': '載入中...',
    'common.copy': '複製',
    'common.close': '關閉',
    'common.auto_fill': 'AI 幫我補',
    'common.ai_magic': 'AI 施法中...',
    'common.start_over': '重新開始',
    'common.copied': '已複製到剪貼簿！',
    'common.confirm_restart': '確定要重新開始嗎？所有未儲存的進度將會遺失。',
    'common.create_new': '創建新角色',
    'common.compiling': '編譯中...',
    'common.error.compilation_failed': '編譯失敗，請重試。',
    'common.error.connection_refused': '錯誤：連線被拒',
    'common.error.request_failed': '錯誤：請求處理失敗',
    'home.title': '人格鍊成',
    'home.subtitle': '召喚你的專屬 AI 角色',
    'home.mode_vibe': '靈感模式',
    'home.desc_vibe': '想到什麼就說什麼，AI 幫你整理成角色。',
    'home.mode_arch': '架構師模式',
    'home.desc_arch': '像工程師一樣，精準填寫規格來打造角色。',
    'home.mode_tool': '工具模式',
    'home.desc_tool': '打造一個有特定功能的 AI 工具人。',
    'home.mode_director': '導演模式',
    'home.desc_director': 'AI 像導演一樣訪談你，挖掘角色深度。',
    'home.mode_antibias': '反偏誤模式',
    'home.desc_antibias': '分析一段話，看看有沒有隱藏的邏輯盲點。',
    'home.workflow_title': '創作流程',
    'home.workflow_desc': '從一個模糊的想法開始，讓 AI 陪你聊天、探索，一步步塑造出獨一無二的生動角色。',
    'home.tools_title': '獨立功能 & 工具',
    'home.recommended': '(推薦)',
    'vibe.title': '靈感模式',
    'vibe.subtitle': '第一步：捕捉火花',
    'vibe.placeholder': '隨便寫點什麼... 感覺、關鍵詞、#標籤',
    'vibe.inspiration': '沒靈感？試試看...',
    'vibe.analyze_btn': '下一步',
    'vibe.intro_msg': '有想到甚麼都可以寫上來喔, 無論是關鍵詞 #標籤 音樂或...',
    'vibe.modify_msg': '歡迎回來，想調整些什麼呢？',
    'vibe.sources': '資料來源',
    'vibe.compiling_desc': '正在將您的想法結構化為人格...',
    'inspiration.title': '挖掘我的思緒...',
    'inspiration.search_placeholder': '搜尋問題...',
    'inspiration.used_count': '✓ 已使用 {count} 題',
    'inspiration.random_btn': '隨機來一題',
    'inspiration.expand_library': '擴充題庫',
    'inspiration.expand_library_tooltip': 'AI 會產生全新的主題分類，並加入到現有題庫中，適合想尋找更多元靈感時使用。',
    'inspiration.optimize_library': 'AI 最佳化',
    'inspiration.optimize_library_short': '最佳化',
    'inspiration.optimize_library_tooltip': 'AI 會審視整個題庫，移除陳舊問題、更新範例，並加入更深刻的問題來提升整體品質。',
    'inspiration.ai_is_thinking': '繆斯思考中...',
    'inspiration.error.unavailable': '抱歉，AI 繆斯暫時無法連線。',
    'inspiration.confirm_btn': '確認使用',
    'inspiration.cancel_btn': '取消',
    'inspiration.quick_add_toast': '已將「{text}」加入靈感',
    'inspiration.daily_muse_toast': '每日靈感已更新！',
    'inspiration.remixing': 'Remix 中...',
    'inspiration.example_label': '例如：',
    'inspiration.remix_success_toast': '靈感庫已 Remix 並更新！',
    'inspiration.reset_btn': '重置',
    'crys.title': '靈感結晶',
    'crys.subtitle': 'AI 已整理您的想法，請檢視或調整。',
    'crys.btn_modify': '返回修改',
    'crys.btn_refine': '深度優化 (導演)',
    'crys.btn_check': '檢查一致性',
    'crys.card_appearance': '外觀',
    'crys.card_personality': '性格',
    'crys.card_backstory': '背景故事',
    'crys.card_speechStyle': '說話風格',
    'crys.card_behaviors': '行為模式',
    'crys.error.regeneration_failed': '重新生成失敗',
    'crys.error.load_failed_title': '錯誤',
    'crys.error.load_failed_desc': '無法載入結構化人格。',
    'check.title': '全方位檢測',
    'check.analyzing_desc': 'AI 正在進行三層式深度掃描：邏輯、偏誤、深度...',
    'check.good': '邏輯檢查：良好',
    'check.issues': '檢測到邏輯矛盾',
    'check.btn_ignore': '忽略',
    'check.btn_fix': '自動修正',
    'check.btn_feature': '轉為特色',
    'check.btn_sim': '進入模擬測試',
    'check.btn_remix': '深度 Remix',
    'check.remix_modal.title': '人格 Remix',
    'check.remix_modal.desc': 'AI 為您的角色注入了更深層的心理維度。請檢視並接受這些變更，以強化您的角色。',
    'check.remix_modal.accept': '接受 Remix',
    'check.remix_modal.field_inner_voice': '內心戲',
    'check.remix_modal.field_core_wound': '核心創傷',
    'check.remix_modal.field_secret_desire': '隱藏渴望',
    'check.remix_modal.field_worldview': '世界觀',
    'check.items_found': '找到 {count} 個項目',
    'check.issue_label': '矛盾點：',
    'check.suggestion_label': 'AI 建議：',
    'check.error.action_failed': '操作失敗，請重試。',
    'check.error.remix_failed': 'Remix 失敗，請重試。',
    'check.depth_title': '角色立體度',
    'check.bias_title': '偏誤檢測',
    'check.depth_score': '完成度',
    'check.missing_elements': '深度補充建議',
    'check.btn_add_depth': 'AI 補充',
    'check.btn_skip_depth': '保持原樣',
    'check.bias_none': '未發現明顯的刻板印象或偏誤。',
    'check.bias_detected': '檢測到潛在偏誤傾向',
    'check.logic_title': '邏輯與一致性',
    'check.btn_antibias_audit': '深度偏誤審查',
    'sim.title': '模擬測試平台',
    'sim.chat': '對話模擬',
    'sim.quotes': '語錄生成',
    'sim.placeholder': '說點什麼...',
    'sim.regenerate': '重新生成',
    'sim.finalize': '完成並匯出',
    'sim.turns_label': '回合數：',
    'sim.error_message': '[錯誤]',
    'final.title': '人格結晶',
    'final.subtitle': '準備部署',
    'final.export_options': '匯出選項',
    'final.export_md': 'Markdown (.md)',
    'final.export_txt': 'Text (.txt)',
    'final.export_json': 'JSON (.json)',
    'director.subtitle': '導演模式 • 模組 1-4',
    'director.sources': '資料來源',
    'director.error_offline': '導演離線了，請稍後再試。',
    'director.finish_btn': '完成並前往檢查 (Check)',
    'director.skip_btn': 'AI 幫我補 (跳過)',
    'director.skip_text': '這題我沒想法，請根據角色感覺幫我決定 (Skip & Auto-fill)',
    'director.system.ready_prompt': '系統就緒。請簡短自我介紹，並只問第一個問題。',
    'director.system.compile_prompt': '訪談已完成。請嚴格依照 [輸出格式]（角色定義、互動協議等）編譯最終的系統提示。',
    'arch.title': '架構師模式',
    'arch.subtitle': '工程學派 • 構造化構建',
    'arch.step1': '核心身分',
    'arch.step2': '語言設定',
    'arch.step3': '態度情感',
    'arch.step4': '範例樣本',
    'arch.step5': '最終藍圖',
    'arch.label_name': '名稱 / 暱稱',
    'arch.label_age': '年齡 (選填)',
    'arch.label_rel': '與使用者的關係',
    'arch.label_tags': '性格關鍵詞',
    'arch.label_desc': '性格綜合描述',
    'arch.label_lang': '主要語言',
    'arch.label_prof': '熟練度 / 口音',
    'arch.label_tics': '口癖 / 第二語言',
    'arch.label_style': '主要語言風格',
    'arch.label_demeanor': '整體舉止神態',
    'arch.label_towards': '對使用者的態度',
    'arch.label_tone': '關鍵語氣詞',
    'arch.label_examples': '對話範例 (Few-Shot)',
    'arch.label_trigger': '最終AI指令',
    'arch.placeholder_tags': '#標籤1 #標籤2',
    'arch.placeholder_examples': '範例1: ...\n範例2: ...',
    'arch.btn_generate': '生成 Prompt',
    'arch.btn_refine': '接續導演模式',
    'tool.title': '工具核心',
    'tool.subtitle': '功能主義 • 協議設計',
    'tool.placeholder': '回應核心的提問...',
    'tool.compile': '[編譯指令集]',
    'tool.compile_prompt': '資料收集完成，請立即輸出最終的工具指令 JSON/Block。',
    'tool.btn_send': '執行',
    'tool.init_prompt': '我需要定義一個新的 AI 工具，請引導我完成整個流程。',
    'tool.sources': '資料來源',
    'antibias.title': '反偏誤核心',
    'antibias.subtitle': '邏輯 • 拆解分析',
    'antibias.placeholder': '描述一個情境或文本以進行分析...',
    'antibias.compile': '[解構偏誤]',
    'antibias.compile_prompt': '分析完成，請提供去偏誤總結與建議。',
    'antibias.init_prompt': '我需要分析一段內容中的心理學偏誤，請啟動解構協議。',
    'antibias.sources': '資料來源',
    'antibias.btn_unsure': '不確定 / 模稜兩可',
    'antibias.unsure_prompt': '我不確定，感覺有點模糊。請協助我分析可能的意圖。'
  }
};

const INSPIRATION_STORAGE_KEY = 'persona_inspiration_data';
const INSPIRATION_TIMESTAMP_KEY = 'persona_inspiration_last_fetch';
const SESSION_STORAGE_KEY = 'persona_session_state'; // Key for auto-save

@Injectable({
  providedIn: 'root'
})
export class WorkflowService {
  private gemini = inject(GeminiService);

  private historyStack = signal<PersonaState[]>([]);
  private currentStateIndex = signal<number>(-1);

  // Inspiration Data - GLOBAL STATE
  inspirationCategories = signal<InspirationCategory[]>(INITIAL_INSPIRATION_DATA);
  
  // Reference Standards
  referenceStandards = signal<ReferenceStandard[]>(REFERENCE_STANDARDS);

  // I18n & Theming State
  currentLang = signal<Language>('zh-TW');
  theme = signal<Theme>('light');
  newInspirationToast = signal<string>('');
  
  // New State for bridging Check Component and Anti-Bias Tool
  antiBiasContext = signal<string | null>(null);
  
  // Translation Helper
  t(key: keyof typeof TRANSLATIONS['zh-TW'], params?: Record<string, string | number>): string {
    const lang = this.currentLang();
    // Use optional chaining or casting to access keys that might not exist in the specific language map
    let translation = (TRANSLATIONS as any)[lang]?.[key] || (TRANSLATIONS as any)['en']?.[key] || key;

    if (params) {
      for (const [paramKey, paramValue] of Object.entries(params)) {
        translation = translation.replace(`{${paramKey}}`, String(paramValue));
      }
    }
    
    return translation;
  }

  // Derived signal
  currentStep = computed(() => this.state().step);
  
  // Active state accessor
  state = computed(() => {
    const idx = this.currentStateIndex();
    const stack = this.historyStack();
    if (idx >= 0 && idx < stack.length) {
      return stack[idx];
    }
    return this.getEmptyState();
  });

  constructor() {
    this.loadState(); // Try to load from localStorage first
    
    // STARTUP LOGIC:
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        // 1. Theme Check
        const storedTheme = localStorage.getItem('theme') as Theme | null;
        if (storedTheme && ['light', 'slate', 'dark', 'black', 'amoled'].includes(storedTheme)) {
            this.theme.set(storedTheme);
        } else {
            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.theme.set(prefersDark ? 'dark' : 'light');
        }

        // 2. Load Persisted Inspiration Library
        const storedInspiration = localStorage.getItem(INSPIRATION_STORAGE_KEY);
        if (storedInspiration) {
            try {
                const parsed = JSON.parse(storedInspiration);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    this.inspirationCategories.set(parsed);
                }
            } catch (e) {
                console.error("Failed to load persisted inspiration data, reverting to default.");
            }
        }
        
        // 3. Daily Muse: Auto-fetch new inspiration if stale
        this.initDailyInspiration();
    }

    // Effect: Auto-save session state and inspiration library when they change
    effect(() => {
       const stack = this.historyStack();
       const index = this.currentStateIndex();
       const inspiration = this.inspirationCategories();

       if (typeof window !== 'undefined' && window.localStorage) {
           if (stack.length > 1 || stack[0]?.vibeMessages.length > 0) { // Only save if there's progress
             localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ history: stack, index }));
           }
           localStorage.setItem(INSPIRATION_STORAGE_KEY, JSON.stringify(inspiration));
       }
    });
  }
  
  private loadState() {
    if (typeof window !== 'undefined' && window.localStorage) {
        const savedState = localStorage.getItem(SESSION_STORAGE_KEY);
        if (savedState) {
            try {
                const { history, index } = JSON.parse(savedState);
                if (Array.isArray(history) && history.length > 0 && typeof index === 'number') {
                    this.historyStack.set(history);
                    this.currentStateIndex.set(index);
                    console.log('Session restored from localStorage.');
                    return;
                }
            } catch (e) {
                console.error('Failed to parse saved state, starting fresh.', e);
                localStorage.removeItem(SESSION_STORAGE_KEY);
            }
        }
    }
    // If no saved state, reset to empty
    this.reset(false); // don't clear storage on initial load
  }

  initDailyInspiration() {
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;

      const lastFetchStr = localStorage.getItem(INSPIRATION_TIMESTAMP_KEY);
      const now = Date.now();
      const cooldown = 1000 * 60 * 60 * 12; // 12 Hours cooldown

      if (!lastFetchStr || (now - parseInt(lastFetchStr) > cooldown)) {
          // Trigger background fetch (fire and forget)
          console.log('Daily Muse: Fetching new inspiration...');
          this.addAIInspirationCategories().then(() => {
              localStorage.setItem(INSPIRATION_TIMESTAMP_KEY, now.toString());
              this.newInspirationToast.set(this.t('inspiration.daily_muse_toast'));
              console.log('Daily Muse: Inspiration updated.');
          }).catch(err => console.warn('Daily Muse: Failed to fetch.', err));
      }
  }

  cycleLang() {
    const langs: Language[] = ['en', 'zh-TW', 'zh-CN', 'ja', 'ko', 'de', 'es', 'fr', 'pt'];
    this.currentLang.update(current => {
        const currentIndex = langs.indexOf(current);
        const nextIndex = (currentIndex + 1) % langs.length;
        return langs[nextIndex];
    });
  }

  cycleTheme() {
    const themes: Theme[] = ['light', 'slate', 'dark', 'black', 'amoled'];
    this.theme.update(current => {
        const currentIndex = themes.indexOf(current);
        const nextIndex = (currentIndex + 1) % themes.length;
        return themes[nextIndex];
    });
  }

  themeIcon = computed(() => {
    switch(this.theme()) {
        case 'light': return 'light_mode';
        case 'slate': return 'bedtime';
        case 'dark': return 'dark_mode';
        case 'black': return 'nightlight';
        case 'amoled': return 'brightness_3';
    }
  });

  private getEmptyState(): PersonaState {
    return {
      step: 'vibe-entry',
      vibeMessages: [],
      currentDraft: '',
      simulationHistory: [],
      simulationType: 'chat'
    };
  }

  // --- State Management ---
  pushState(newStatePartial: Partial<PersonaState>) {
    const current = this.state();
    const merged: PersonaState = { ...current, ...newStatePartial };
    const newStack = this.historyStack().slice(0, this.currentStateIndex() + 1);
    newStack.push(merged);
    this.historyStack.set(newStack);
    this.currentStateIndex.set(newStack.length - 1);
  }

  undo() {
    if (this.currentStateIndex() > 0) {
      this.currentStateIndex.update(i => i - 1);
    }
  }

  redo() {
    if (this.currentStateIndex() < this.historyStack().length - 1) {
      this.currentStateIndex.update(i => i - 1);
    }
  }

  setStep(step: PipelineStep) {
    if (this.state().step !== step) {
        this.pushState({ step });
    }
  }

  reset(clearStorage: boolean = true) {
    this.historyStack.set([this.getEmptyState()]);
    this.currentStateIndex.set(0);
    if (clearStorage && typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }

  initDirectorMode(initialDraft: string = '') {
    const state: PersonaState = {
        ...this.getEmptyState(),
        currentDraft: initialDraft,
        step: 'refine-director'
    };
    this.historyStack.set([state]);
    this.currentStateIndex.set(0);
  }
    
  get currentStateIndexValue() {
    return this.currentStateIndex();
  }

  // --- Inspiration Library Management (Global) ---
  
  async remixInspirationLibrary(): Promise<void> {
      try {
          const currentData = this.inspirationCategories();
          const remixedData = await this.gemini.remixInspiration(currentData, this.currentLang());
          this.inspirationCategories.set(remixedData);
      } catch (e) {
          throw e;
      }
  }

  async addAIInspirationCategories(): Promise<void> {
      try {
          const aiCategories = await this.gemini.generateInspirationQuestions(this.currentLang());
          this.inspirationCategories.update(current => {
             const nonAiCategories = current.filter(c => !c.id.startsWith('ai-gen'));
             return [...aiCategories, ...nonAiCategories];
          });
      } catch (e) {
          throw e;
      }
  }

  resetInspirationLibrary() {
      this.inspirationCategories.set(INITIAL_INSPIRATION_DATA);
      localStorage.removeItem(INSPIRATION_STORAGE_KEY);
      localStorage.removeItem(INSPIRATION_TIMESTAMP_KEY);
  }
}
