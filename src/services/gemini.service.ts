

import { Injectable } from '@angular/core';
import { GoogleGenAI, Chat, Type, GenerateContentParameters } from '@google/genai';
// FIX: Import `Language` type to correctly type the chat initialization methods.
import { StructuredPersona, FullAnalysisReport, Language, InspirationCategory, RemixData, ReferenceStandard } from './workflow.service';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private ai: GoogleGenAI;
  private modelId = 'gemini-2.5-flash';
  
  // Reusable config for enabling web search
  private webConfig: GenerateContentParameters['config'] = {
    tools: [{ googleSearch: {} }]
  };

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env['API_KEY'] });
  }

  // --- 1. VibeCode Entry ---
  // UPDATED: Now accepts language to enforce localization
  startVibeCodeChat(language: Language): Chat {
    const systemPrompt = `
# Role: Persona Muse (Vibe Mode)

## Your Task
You are a creative assistant helping a user build an AI persona from scratch. The user is starting with only vague feelings, keywords, or fragmented ideas. Your first job is to make them feel comfortable sharing these abstract concepts. The user has already seen an initial message encouraging them to share anything (emojis, tags, music, colors, etc.). Your role is to be an empathetic listener and prompter. Ask gentle, guiding questions to help the user explore their own ideas.

## Your Conversational Style
- Gentle, encouraging, curious, and evocative.
- Ask open-ended, feeling-based questions. "That's a powerful image. What kind of memories does that color hold?" "What kind of music would be playing in their quietest moments?"
- AVOID asking for lists, traits, or structured information. This is about feeling, not facts.
- Keep your replies short and poetic.
- The goal is to collect enough "vibe" material to later form a persona.

## CRITICAL LANGUAGE PROTOCOL
- **You MUST interact with the user in this language: ${language}.**
- Even if the user provides keywords in other languages (e.g., Japanese ACG terms like "Tsundere", "Kuudere", "Fushigi-kei"), you MUST reply and discuss them in **${language}**. Do not switch to Japanese or English unless explicitly asked.
`;
    return this.ai.chats.create({
      model: this.modelId,
      config: { ...this.webConfig, systemInstruction: systemPrompt }
    });
  }

  async structureVibe(conversationHistory: string, language: Language): Promise<StructuredPersona> {
    const personaSchema = {
      type: Type.OBJECT,
      properties: {
        appearance: { type: Type.STRING, description: 'A detailed description of the character\'s physical appearance, clothing style, and overall visual presence.' },
        personality: { type: Type.STRING, description: 'A deep dive into the character\'s core personality traits, including their temperament, key motivations, and any internal conflicts.' },
        backstory: { type: Type.STRING, description: 'A framework for the character\'s background story, highlighting key events or relationships that shaped them.' },
        speechStyle: { type: Type.STRING, description: 'The character\'s unique style of speaking, including their tone, vocabulary, cadence, and any verbal tics.' },
        behaviors: { type: Type.STRING, description: 'Typical behavior patterns, habits, or mannerisms the character exhibits in various situations.' },
      },
      required: ['appearance', 'personality', 'backstory', 'speechStyle', 'behaviors']
    };

    const prompt = `
    Based on this abstract conversation, analyze and structure the information into the following categories. Be creative and fill in the gaps where needed to create a cohesive whole.
    
    **CRITICAL LANGUAGE INSTRUCTION**: The content of the generated fields MUST be in this language: ${language}.
    
    Conversation: ${conversationHistory}
    `;

    const response = await this.ai.models.generateContent({
      model: this.modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: personaSchema,
      },
    });
    
    const parsed = JSON.parse(response.text);
    return parsed as StructuredPersona;
  }

  async regenerateVibeSection(conversationHistory: string, persona: StructuredPersona, section: keyof StructuredPersona, language: Language): Promise<string> {
      const prompt = `
      Based on the original conversation and the current persona draft, regenerate ONLY the "${section}" part to offer a fresh perspective.
      
      Original Conversation for context:
      ${conversationHistory}
      
      Current full persona draft:
      ${JSON.stringify(persona, null, 2)}
      
      Regenerate the "${section}" section. Output only the new text for that section.
      
      **CRITICAL LANGUAGE INSTRUCTION**: The output text MUST be in this language: ${language}.
      `;
      const response = await this.ai.models.generateContent({ model: this.modelId, contents: prompt, config: this.webConfig });
      return response.text;
  }

  compileStructuredPrompt(persona: StructuredPersona | (StructuredPersona & RemixData)): string {
    const basePrompt = `
## Appearance
${persona.appearance}

## Personality
${persona.personality}

## Backstory Framework
${persona.backstory}

## Speech & Communication Style
${persona.speechStyle}

## Behavioral Patterns
${persona.behaviors}
    `.trim();

    // Check if it's a RemixedPersona
    if ('inner_voice' in persona) {
        const remixedPart = `

---
## Inner Voice (<inner_voice>)
${persona.inner_voice}

## Core Wound
${persona.core_wound}

## Secret Desire
${persona.secret_desire}

## Worldview
${persona.worldview}
        `.trim();
        return `${basePrompt}\n\n${remixedPart}`;
    }

    return basePrompt;
  }

  // --- 2. Director Refinement (Updated to Intention-based Director Mode) ---
  startDirectorChat(currentDraft: string): Chat {
    const systemPrompt = `
# Role: AI Persona Director (Intention-Based / 意圖派導演)

## Philosophy: The "Iceberg Theory"
You follow the **Intention-Based (意圖派)** philosophy of character creation.
1.  **Core > Surface**: Behavior is driven by internal desires, fears, and conflicts, not just lists of adjectives.
2.  **Inner Voice**: A character must "think" before they speak. This creates depth and subtext.
3.  **Dynamic Intent**: In every interaction, the character has a goal (e.g., to impress, to hide insecurity, to test the user).
4.  **High-Context, Low-Rule**: Instead of rigid rules ("Don't be rude"), we define the character's *disposition* ("He is rude because he is defensive about his intelligence").

## Context
We have a Draft Persona:
"""
${currentDraft}
"""

## Goal
Conduct a "Deep Dive Interview" to flesh out the hidden dimensions of this character.
Your ultimate goal is to compile a System Prompt that forces the AI to simulate the character's *inner thoughts* (e.g., using \`<inner_voice>\` tags) before generating dialogue.

## Interaction Protocol (CRITICAL RULES)
1.  **One Question at a Time**: Absolutely ONE question per turn.
2.  **Conversational**: Act like a demanding but brilliant movie director. "Cut! That's too generic. Why is he *really* doing that?"
3.  **Handling Skips**: If the user skips, use your knowledge of the "Vibe" to creatively fill the gap.

## Interview Process (Sequential)
Follow this sequence to build the layers.

### Module 1: The Core Conflict (矛盾與張力)
- Q1: What is the character's "Core Wound" or "Secret Fear" that they try to hide?
- Q2: How does this fear conflict with what they *want* the user to think of them? (The Mask vs. The Self).

### Module 2: Relational Dynamics (動態關係)
- Q3: Specifically, what does the character *want* from the user? (e.g., validation, redemption, entertainment, or just to be left alone?).

### Module 3: Cognitive Process (思維路徑)
- Q4: **CRITICAL**: Describe how the character thinks. Do they overanalyze? Are they impulsive? Do they filter their thoughts?
- Q5: Give me an example of what they might *think* (Inner Voice) vs. what they actually *say*.

### Module 4: Engineering Constraints (工程邊界)
- Q6: Are there any absolute forbidden topics or behaviors? (The "Red Lines").

## Output Format (Compilation)
When the user says "Finish" or "Compile", generate a System Prompt using the **"Intention-Based Structure"**:
1.  **[Role Definition]**: Who they are (The Mask).
2.  **[Core Logic]**: The internal conflicts and desires (The Engine).
3.  **[Thinking Protocol]**: Instructions to generate specific XML tags (e.g., \`<inner_voice>\`, \`<strategy>\`) to reveal their internal state *before* the response.
4.  **[Style & Tone]**: Examples.

## Start
Greet the user as the Director. Be insightful. Ask Q1 immediately.
`;
    return this.ai.chats.create({
      model: this.modelId,
      config: { ...this.webConfig, systemInstruction: systemPrompt }
    });
  }

  async updateDraft(oldDraft: string, refinementConversation: string): Promise<string> {
     // Legacy method kept for interface compatibility
     const prompt = `
    Based on the Director's interview log below, compile the FINAL System Prompt following the structure:
    [Role Definition], [Interaction Protocol], [Few-Shot Examples], [Negative Constraints].
    
    Conversation Log:
    ${refinementConversation}
    
    Return ONLY the System Prompt.
    `;
    const response = await this.ai.models.generateContent({
      model: this.modelId,
      contents: prompt,
      config: this.webConfig
    });
    return response.text;
  }

  // --- 3. Consistency Check (DEEP ANALYSIS) ---
  // Updated: 3-Layer Check (Logic, Bias, Depth)
  async analyzePersonaDeeply(personaData: StructuredPersona, language: Language): Promise<FullAnalysisReport> {
    const schema = {
      type: Type.OBJECT,
      properties: {
        logical_conflicts: {
          type: Type.ARRAY,
          items: {
             type: Type.OBJECT,
             properties: {
                type: { type: Type.STRING },
                detail: { type: Type.STRING },
                severity: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
                suggestion: { type: Type.STRING }
             },
             required: ['type', 'detail', 'severity', 'suggestion']
          }
        },
        bias_analysis: {
          type: Type.OBJECT,
          properties: {
             bias_detected: { type: Type.BOOLEAN },
             bias_type: { type: Type.STRING },
             evidence: { type: Type.STRING },
             gentle_suggestion: { type: Type.STRING }
          },
          required: ['bias_detected']
        },
        depth_assessment: {
          type: Type.OBJECT,
          properties: {
             completeness_score: { type: Type.NUMBER },
             missing_elements: {
               type: Type.ARRAY,
               items: {
                 type: Type.OBJECT,
                 properties: {
                   element: { type: Type.STRING },
                   question: { type: Type.STRING },
                   why_important: { type: Type.STRING }
                 },
                 required: ['element', 'question', 'why_important']
               }
             },
             strengths: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ['completeness_score', 'missing_elements', 'strengths']
        }
      },
      required: ['logical_conflicts', 'bias_analysis', 'depth_assessment']
    };

    const prompt = `
    Analyze this AI Persona Data. You are a Senior Editor and Logic Auditor.
    Perform a 3-part analysis:

    【PART 1: LOGIC CHECK】
    Identify contradictions in:
    1. Timeline (Age vs Experience)
    2. Personality vs Behavior (e.g. Introvert but Party Animal)
    3. Ability vs Background (e.g. Slum dweller who plays expert Golf)
    4. Values (e.g. Selfish but acts altruistically without reason)
    
    *Severity Rules:*
    - High: Physically impossible or completely breaks immersion.
    - Medium: Unlikely but possible (needs explanation).
    - Low: Minor nitpicks.
    *Humanity Exception:* Do NOT flag psychological paradoxes (e.g. "Cruel but loves kittens") as errors unless they are unexplained. These are depth features.

    【PART 2: BIAS DETECTION】
    Check for:
    1. Mary Sue / Jack Sue (Flawless, everyone loves them)
    2. Stereotypes (Cookie-cutter templates)
    3. Flatness (No internal motivation)
    4. Melodrama (Tragedy stacking)
    If detected, provide a VERY gentle, encouraging suggestion. "This character is charming! Maybe adding X would make them even more real."

    【PART 3: DEPTH ASSESSMENT】
    Evaluate dimensionality based on:
    1. Motivation Layer (Why do they do this?)
    2. Conflict Layer (Inner tensions)
    3. Growth Layer (Capacity for change)
    4. Relational Layer (Meaningful bonds)
    
    Provide a score (0-100) and list missing elements as thoughtful questions for the user.

    **CRITICAL OUTPUT RULE**: All descriptions, suggestions, and questions MUST be in this language: ${language}.
    
    Persona Data:
    ${JSON.stringify(personaData, null, 2)}
    `;
    
    const response = await this.ai.models.generateContent({
      model: this.modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });
    
    try {
        return JSON.parse(response.text) as FullAnalysisReport;
    } catch (e) {
        console.error("Analysis Parse Error", e);
        // Return empty fallback
        return {
            logical_conflicts: [],
            bias_analysis: { bias_detected: false },
            depth_assessment: { completeness_score: 0, missing_elements: [], strengths: [] }
        };
    }
  }

  async autoFixConflict(persona: StructuredPersona, conflictDescription: string, suggestion: string): Promise<StructuredPersona> {
    const personaSchema = {
      type: Type.OBJECT,
      properties: {
        appearance: { type: Type.STRING },
        personality: { type: Type.STRING },
        backstory: { type: Type.STRING },
        speechStyle: { type: Type.STRING },
        behaviors: { type: Type.STRING },
      },
      required: ['appearance', 'personality', 'backstory', 'speechStyle', 'behaviors']
    };

    const prompt = `
    Fix the following conflict in the Persona. 
    Conflict: ${conflictDescription}
    Suggestion: ${suggestion}
    
    Current Persona:
    ${JSON.stringify(persona, null, 2)}
    
    Return the UPDATED Persona JSON. Keep unchanged sections as they are.
    `;
    
    const response = await this.ai.models.generateContent({
      model: this.modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: personaSchema
      }
    });

    return JSON.parse(response.text) as StructuredPersona;
  }

  async harmonizeConflict(persona: StructuredPersona, conflictDescription: string): Promise<StructuredPersona> {
    const personaSchema = {
      type: Type.OBJECT,
      properties: {
        appearance: { type: Type.STRING },
        personality: { type: Type.STRING },
        backstory: { type: Type.STRING },
        speechStyle: { type: Type.STRING },
        behaviors: { type: Type.STRING },
      },
      required: ['appearance', 'personality', 'backstory', 'speechStyle', 'behaviors']
    };

    const prompt = `
    The user wants to embrace the following conflict as a unique character feature ("Gap Moe", "Complex Trait", or "Contrast").
    Instead of fixing the inconsistency, rewrite the relevant sections to explain WHY this contradiction exists and how it manifests as a charming or interesting trait.
    Make it a highlight of the persona.

    Conflict to harmonize: ${conflictDescription}
    
    Current Persona:
    ${JSON.stringify(persona, null, 2)}
    
    Return the UPDATED Persona JSON with these traits integrated.
    `;
    
    const response = await this.ai.models.generateContent({
      model: this.modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: personaSchema
      }
    });

    return JSON.parse(response.text) as StructuredPersona;
  }
  
  // NEW: Deep Remix Function (Updated with Language enforcement)
  async remixPersona(persona: StructuredPersona, language: Language): Promise<RemixData> {
    const remixSchema = {
      type: Type.OBJECT,
      properties: {
        inner_voice: { type: Type.STRING, description: "The character's unspoken inner monologue, revealing their true thoughts vs. their spoken words." },
        core_wound: { type: Type.STRING, description: "A significant past event or trauma that secretly drives their current behavior and fears." },
        secret_desire: { type: Type.STRING, description: "A deep, often unacknowledged, desire that conflicts with their outward personality." },
        worldview: { type: Type.STRING, description: "The character's fundamental philosophy or belief about how the world works." },
      },
      required: ['inner_voice', 'core_wound', 'secret_desire', 'worldview']
    };

    const prompt = `
    Act as a master creative writer. I have a well-defined character persona. Your task is to give it a soul by adding deep psychological layers.
    Based on the provided persona, invent and define the following four elements to make the character truly compelling and three-dimensional.

    **OUTPUT LANGUAGE REQUIREMENT**: You MUST generate the content in this language: ${language}.

    Persona Data:
    ${JSON.stringify(persona, null, 2)}

    Generate the four psychological elements now. Be creative, insightful, and ensure they are consistent with the existing persona.
    `;
    
    const response = await this.ai.models.generateContent({
      model: this.modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: remixSchema
      }
    });

    return JSON.parse(response.text) as RemixData;
  }

  // NEW: Brainstorm Single Element
  async brainstormElement(persona: StructuredPersona, question: string, language: Language): Promise<string> {
      const prompt = `
      Act as a creative muse. Based on the persona below, answer this deep question to add depth to the character.
      
      Question: "${question}"
      
      Persona:
      ${JSON.stringify(persona, null, 2)}
      
      Provide a concise, creative answer in ${language} that fits the existing vibe perfectly.
      `;
      const response = await this.ai.models.generateContent({ model: this.modelId, contents: prompt, config: this.webConfig });
      return response.text.trim();
  }

  // --- NEW: Compare with Reference Standard ---
  async compareWithStandard(currentDraft: string, standard: ReferenceStandard, language: Language): Promise<string> {
    const prompt = `
    Act as a Senior Prompt Engineer. Compare the user's "Current Draft" against the provided "Reference Standard".
    
    Reference Standard Type: ${standard.type} (${standard.title})
    Reference Standard Philosophy: ${standard.description}
    Reference Content:
    """
    ${standard.content}
    """
    
    User's Current Draft:
    """
    ${currentDraft}
    """
    
    Task:
    Analyze the User's Draft. Does it embody the philosophy of the Reference Standard?
    
    Output a concise report in ${language} covering:
    1. **Structural Analysis**: Does the format match?
    2. **Philosophy Check**: Does it have the same depth (Intention) or precision (Engineering)?
    3. **Missing Elements**: What specific tags or sections are missing compared to the standard?
    4. **Recommendation**: One concrete step to bring it closer to the standard.
    `;
    
    const response = await this.ai.models.generateContent({
      model: this.modelId,
      contents: prompt,
      config: this.webConfig
    });
    
    return response.text;
  }

  // --- 4. Simulation ---
  startSimulationChat(personaPrompt: string): Chat {
    return this.ai.chats.create({
      model: this.modelId,
      config: { ...this.webConfig, systemInstruction: personaPrompt }
    });
  }

  async generateQuotes(personaPrompt: string, language: Language): Promise<string> {
    const prompt = `
    Generate 10 distinct quotes/dialogue lines for this character in various scenarios (Anger, Joy, Boredom, etc.).
    Format as a list.
    
    **CRITICAL LANGUAGE INSTRUCTION**: The generated quotes MUST be in the target language: ${language}.
    
    Persona: ${personaPrompt}
    `;
    const response = await this.ai.models.generateContent({
      model: this.modelId,
      contents: prompt,
      config: this.webConfig
    });
    return response.text;
  }

  // --- Tool / Architect ---
  startToolChat(language: Language): Chat {
    const prompts: Partial<Record<Language, string>> = {
      en: `
# Role: Systems Architect (Engineering-Based)

## Philosophy
You follow the **Engineering-Based** philosophy of Prompt Engineering:
1.  **Structure First**: Clear Input, Process, and Output definitions.
2.  **Determinism**: Eliminate ambiguity. Define edge cases.
3.  **Functional**: Focus on task execution reliability, not personality.

## Protocol: SEQUENTIAL_SPECIFICATION_PROTOCOL
- You are a functional engine designed to help a user define a technical directive or tool.
- Your interaction must be strictly sequential. **Ask one question at a time and wait for the user's response.** Do not proceed until you receive an answer.
- Your tone must be concise, technical, and objective. Use terminology like "Acknowledged", "Parameter required", "Proceeding to next step".

## Interview Process (Strictly Sequential)
Follow this exact order. **One question at a time.**

1.  **Core Function (North Star)**: What is the SINGLE specific problem this tool solves? What is its main job?
2.  **Input Spec**: What is the exact format of the input data? (JSON, raw text, code, CSV?). Provide examples.
3.  **Process Logic**: Describe the step-by-step transformation. If complex, define the Chain of Thought.
4.  **Output Spec**: What is the strict format of the result? (Markdown table, JSON schema, specific report format?).
5.  **Error Handling**: How should it handle malformed or incomplete input? (Fail gracefully).
6.  **Constraints**: What is absolutely forbidden? (Security, length, style constraints).

## Compilation
When asked to compile, generate a structured System Prompt containing:
- \`[Role & Objective]\`
- \`[Input Format]\`
- \`[Step-by-Step Instructions]\`
- \`[Output Format]\`
- \`[Constraints]\`

## Start
Initiate the session. Explain your purpose as a Systems Architect and ask the first question about the Core Function.
`,
      'zh-TW': `
# 角色：系統架構師 (工程派 / Engineering-Based)

## 哲學
你遵循「工程派」的 Prompt Engineering 哲學：
1.  **結構至上**：清晰的輸入(Input)、處理邏輯(Process)、輸出(Output)。
2.  **確定性**：消除模糊空間，定義邊界條件 (Edge Cases)。
3.  **功能導向**：不追求花俏的設定，只追求精準執行任務。

## 協議：序列化規格協議 (SEQUENTIAL_SPECIFICATION_PROTOCOL)
- 你的互動必須嚴格遵守序列。**一次只問一個問題，然後等待使用者的回覆。**
- 你的語氣必須簡潔、技術性且客觀。

## 訪談流程 (序列化)
請遵循此確切順序。**一次一問。**

1.  **核心功能定義**：這個工具唯一的「北極星指標」(North Star Metric) 是什麼？它必須解決什麼具體問題？
2.  **輸入規格 (Input Spec)**：它接受什麼格式的資料？(JSON, 純文字, 代碼, 模糊描述?)
3.  **處理邏輯 (Process Logic)**：請描述處理步驟。如果是複雜任務，我們需要定義思維鏈 (Chain of Thought)。
4.  **輸出規格 (Output Spec)**：結果必須長什麼樣子？(Markdown 表格, JSON, 特定格式的報告?)
5.  **錯誤處理 (Error Handling)**：如果輸入資料不完整或有誤，它該怎麼報錯？(Fail Gracefully).
6.  **安全與限制 (Constraints)**：有什麼是它絕對**不能**做的？

## 輸出 (編譯)
當收集完成後，請生成一份結構嚴謹的 System Prompt，包含：
- \`[Role]\`
- \`[Task]\`
- \`[Input Format]\`
- \`[Workflow/Steps]\`
- \`[Output Rules]\`
- \`[Constraints]\`

## 開始
請以專業、精準、邏輯嚴密的口吻開始。初始化協議，並詢問第一個問題（核心功能）。
`
    };

    const systemPrompt = prompts[language] || prompts['en'];
    
    return this.ai.chats.create({
      model: this.modelId,
      config: { ...this.webConfig, systemInstruction: systemPrompt }
    });
  }

  // FIX: Widen the language parameter to accept any language from the workflow service.
  // UPDATE: Add optional 'context' to seed the anti-bias chat with persona data
  startAntiBiasChat(language: Language, context?: string): Chat {
    const basePrompts: Partial<Record<Language, string>> = {
      en: `
# Role: Anti-Bias Core (Cognitive Detective)

## Protocol: INTUITIVE_TO_LOGICAL_PROTOCOL
- You are a cognitive analysis engine designed to help users identify biases, even when they only have a vague feeling that "something is off."
- Your interaction must be strictly sequential. **Ask one question at a time and wait for the user's response.**
- Your tone: Analytical but empathetic. You understand that intuition often precedes logic.

## Deconstruction Process (Strictly Sequential)
Follow this exact order. **One question at a time.**

1.  **Identify the Unease**: Ask the user to describe the "feeling" if they can't describe the logic. (e.g., "To start, what situation are we looking at? If you just feel 'something is wrong' but can't articulate why, that's okay—describe the feeling or the trigger.")
2.  **Pinpoint the Trigger (Exploration)**: If the user is vague, probe for the specific trigger. (e.g., "Is it the *tone* that feels condescending? Or does it seem like there's a hidden assumption? Try to point to the specific sentence or action that bothers you.")
3.  **Clarify the Intent**:
    - Goal: Probe the original motive of the person involved (or the author).
    - **Instruction**: Do NOT ask robotically "What is the goal?". Offer guiding options based on the context to inspire the user.
    - **Reference Phrasing**: "What do you think the author's original intention was? Were they trying to explain a phenomenon? Or were they trying to persuade you to accept a specific viewpoint? Or perhaps trying to hide something?"
4.  **Check for Blind Spots**: Gently probe for specific biases based on the previous answers.
5.  **Shift Perspective**: Ask the user to describe the situation from an opposite point of view.
6.  **Summary & Recommendation**: Provide the analysis.

## Start
Initiate the session. Example opening: "Protocol initialized. I am the Anti-Bias Core. Often, our intuition detects bias before our logic does. To start, what situation have you encountered? Or is there a piece of text that just feels 'off' to you?"
`,
      'zh-TW': `
# 角色：反偏誤核心 (認知偵探 & 邏輯分析師)

## 協議：直覺轉譯邏輯協議 (INTUITIVE_TO_LOGICAL_PROTOCOL)
- 你是一個旨在協助使用者識別認知偏誤的分析引擎。
- 特點：你明白「偏誤」往往最初只是一種「說不出的怪異感」或「不舒服」。你的任務是引導使用者將這種直覺轉化為邏輯分析。
- 你的互動必須嚴格遵守序列。**一次只問一個問題，然後等待使用者的回覆。**

## 解構流程 (嚴格序列化)
請遵循此確切順序。**一次一問。**

1.  **捕捉違和感 (Identify the Unease)**：
    - 詢問使用者遇到了什麼狀況。
    - **關鍵**：明確告訴使用者，如果說不出具體哪裡錯了也沒關係，請他們描述那種「怪怪的」感覺。(例如：「首先，請告訴我你遇到了什麼？如果你覺得這段話或這件事『哪裡怪怪的』但說不上來，請試著描述那種感覺。」)

2.  **定位觸發點 (Pinpoint the Trigger)**：
    - 如果使用者的描述很模糊，請協助他們聚焦。
    - 追問：(例如：「這種不舒服的感覺來自哪裡？是因為對方的『語氣』讓你覺得被冒犯？還是這句話背後好像『預設』了什麼立場？試著指出最讓你介意的那一點。」)

3.  **釐清意圖 (Clarify the Intent)**：
    - 目標：探究當事人（或文本作者）的原始動機。
    - **指令**：不要機械式地問「目的是什麼」。請根據上下文提供引導選項來啟發使用者。
    - **參考話術**：「你認為這句話的作者原本想要達成的目的是什麼？他們是想解釋一種現象？還是想說服你接受某種觀點？亦或是想掩飾什麼？」

4.  **思維盲點探查 (Check for Blind Spots)**：
    - 根據前面的回答，提出具體的偏誤假設。(例如：「如果是這樣，有沒有可能是因為『確認偏誤』，導致他們只看到了自己想看的？」)

5.  **換位思考 (Shift Perspective)**：
    - 要求使用者站在完全相反的立場，重新描述這件事。

6.  **總結與建議 (Summary)**：
    - 彙整分析結果，指出潛在的認知偏誤，並提供客觀的建議。

## 開始
啟動協議。你的第一則訊息必須讓使用者感到放鬆，鼓勵他們從直覺出發。
範例開場：「協議初始化。我是反偏誤核心。很多時候，我們的大腦會比邏輯先一步察覺到『不對勁』。首先，請告訴我你遇到了什麼狀況？或者，有哪一段話讓你覺得『感覺怪怪的』？」
`,
      // ... (other languages omitted for brevity, fallback to English logic if needed)
    };

    let systemPrompt = basePrompts[language] || basePrompts['en'];

    if (context) {
        systemPrompt += `\n\n## SPECIAL CONTEXT INJECTION (Persona Audit)
The user has provided a specific text (a Persona Draft) for analysis.
**Context**:
"""
${context}
"""
**Instruction**:
- SKIP Step 1 (Identify the Unease).
- Start immediately by confirming you have read the Persona Draft.
- Your goal is to identify potential stereotypes, flatness (lack of depth), or "Mary Sue" tendencies in this character.
- Ask the user to focus on a specific aspect of this character that they feel might be weak or biased.
`;
    }
    
    return this.ai.chats.create({
      model: this.modelId,
      config: { ...this.webConfig, systemInstruction: systemPrompt }
    });
  }
  
  async compileArchitectPrompt(data: any): Promise<string> {
     // Updated to be more 'Engineering' focused
     const prompt = `
     Role: Expert Prompt Engineer.
     Task: Compile a structured System Prompt (Architect Mode) for a Persona based on the specification below.
     
     Specification:
     - Name: ${data.name}
     - Relationship: ${data.relationship}
     - Style: ${data.styleDescription}
     - Age: ${data.age}
     - Tags: ${data.tags}
     - Description: ${data.fusionDescription}
     - Language: ${data.primaryLang} (${data.proficiency})
     - Tics/Habits: ${data.tics}
     - Demeanor: ${data.generalDemeanor}
     - Attitude: ${data.towardsUser}
     - Tone: ${data.toneWords}
     - Examples: ${data.examples}
     - Trigger/Instruction: ${data.finalInstruction}
     
     Format Requirements:
     - Use clear Markdown headers.
     - Include a [Role Definition] section.
     - Include a [Tone & Style] section with bullet points.
     - Include a [Few-Shot Examples] section if examples are provided.
     - Include a [System Instruction] or [Trigger] section.
     - Optimize for LLM adherence (Engineering-based).
     `;
     const response = await this.ai.models.generateContent({ model: this.modelId, contents: prompt, config: this.webConfig });
     return response.text;
  }
  
  async polishSection(section: string, original: string): Promise<string> {
    const prompt = `Refine this text for a persona prompt: "${original}"`;
    const response = await this.ai.models.generateContent({ model: this.modelId, contents: prompt, config: this.webConfig });
    return response.text.trim();
  }

  // --- NEW: Universal Auto-Fill ---
  async generateFieldSuggestion(fieldName: string, currentContext: any, userIntent: string = ''): Promise<string> {
      const prompt = `
      You are an AI assistant helping a user fill out a form to create a character/persona.
      
      Task: Suggest creative content for the field: "${fieldName}".
      
      Context (what we know so far):
      ${JSON.stringify(currentContext, null, 2)}
      
      User's extra intent (if any): ${userIntent}
      
      ## Rules:
      1.  **CRITICAL**: You MUST use your web search tool to find inspiration from literature, mythology, psychology (e.g., Jungian archetypes), and modern culture to provide non-obvious, creative suggestions.
      2.  Provide ONLY the text for the field. No explanations, no quotation marks.
      3.  For 'Tags', think like a novelist (e.g., #FallenIdealist #WandererWithASecretPast), not a database.
      4.  For 'Description' or similar text areas, write with a literary flair, weaving the tags and context into a compelling narrative.
      5.  If the context is empty, invent a creative, interesting default that inspires the user.
      6.  **Translate Concepts**: When using concepts from psychology or mythology (e.g., Jungian archetypes like 'The Shadow'), do NOT output the academic term. Instead, translate it into a descriptive tag or narrative. For example, for 'The Shadow', suggest tags like '#ConfrontingInnerDemons' or describe a character who is 'haunted by a past they refuse to acknowledge'.
      `;
      
      const response = await this.ai.models.generateContent({
          model: this.modelId,
          contents: prompt,
          config: this.webConfig
      });
      return response.text.trim();
  }

  // --- NEW: AI-Generated Inspiration ---
  async generateInspirationQuestions(language: Language): Promise<InspirationCategory[]> {
    const inspirationSchema = {
      type: Type.OBJECT,
      properties: {
        categories: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              icon: { type: Type.STRING },
              title: { type: Type.STRING },
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    text: { type: Type.STRING },
                    type: { type: Type.STRING, enum: ['standard', 'color', 'reference'] },
                    example: { type: Type.STRING },
                    placeholder: { type: Type.STRING },
                  },
                  required: ['id', 'text', 'type', 'example']
                }
              }
            },
            required: ['id', 'icon', 'title', 'questions']
          }
        }
      }
    };

    const prompt = `
    You are a creative muse for a character creation tool. Your task is to generate 2-3 NEW, INTERESTING, and USEFUL categories of inspiration questions for users building a fictional character.

    ## Creative Guardrails (VERY IMPORTANT)
    
    ### Topics to FOCUS ON:
    - Psychological depth (fears, desires, blind spots)
    - Moral gray areas and internal dilemmas
    - Unique relationship dynamics (e.g., rival, mentor, unrequited love)
    - Backstory hooks and secrets
    - Defining life events that shaped the character
    - Personal quirks, habits, and rituals
    - Character archetypes (e.g., The Rebel, The Trickster)

    ### Topics to AVOID at all costs (Blocklist):
    - **Real-World Policy & Governance:** Do NOT ask about environmental sustainability, macroeconomics, technological regulation, AI governance policy, global politics, or complex legal frameworks. These are out of scope.
    - **Abstract Academia:** Avoid overly academic or abstract philosophical questions not directly tied to a character's tangible actions, beliefs, or backstory.
    - **User-Unfriendly Questions:** Do not ask questions that require specialized knowledge (e.g., advanced physics, niche history) for a typical user to answer.
    - **Translation Rule:** If you are using a psychological concept (e.g., cognitive dissonance, attachment theory), you MUST translate it into a simple, relatable question about the character's feelings or behavior. For example, instead of "Describe the character's cognitive dissonance," ask "What's something the character does, even though they know it's wrong or against their beliefs?"

    ## Rules:
    - Generate 2-3 distinct categories.
    - Each category must have 3-5 insightful questions.
    - All content (titles, questions, examples) MUST be in the target language: ${language}.
    - IDs must be unique and prefixed with 'ai-gen-'. For example: 'ai-gen-cat-1', 'ai-gen-q-1'.
    - **Icons should be valid Material Design Icon names (snake_case, e.g. 'rocket_launch', 'school'). Do not use Emojis.**
    
    Generate the JSON output now.
    `;
    
    const response = await this.ai.models.generateContent({
      model: this.modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: inspirationSchema
      },
    });

    try {
        const textToParse = response.text.replace(/```json\n?|\n?```/g, '').trim();
        const parsed = JSON.parse(textToParse);
        return (parsed.categories || []) as InspirationCategory[];
    } catch (e) {
        console.error("Failed to parse inspiration questions:", e);
        return [];
    }
  }

  // --- NEW: Remix / Evolve Inspiration ---
  async remixInspiration(currentCategories: InspirationCategory[], language: Language): Promise<InspirationCategory[]> {
    const inspirationSchema = {
      type: Type.OBJECT,
      properties: {
        categories: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              icon: { type: Type.STRING },
              title: { type: Type.STRING },
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    text: { type: Type.STRING },
                    type: { type: Type.STRING, enum: ['standard', 'color', 'reference'] },
                    example: { type: Type.STRING },
                    placeholder: { type: Type.STRING },
                  },
                  required: ['id', 'text', 'type', 'example']
                }
              }
            },
            required: ['id', 'icon', 'title', 'questions']
          }
        }
      }
    };

    const prompt = `
    Act as a Master Editor for a character creation tool. 
    I will provide the current list of Inspiration Categories and Questions.
    
    Your Task:
    1. Review the existing questions.
    2. REMOVE questions that are boring, cliché, or outdated.
    3. KEEP the classic, high-value questions (like "What is their core conflict?").
    4. ADD new, trendy, or deep psychological questions to spice it up.
    5. UPDATE examples to be more modern (reference 2024+ anime, games, memes if applicable).
    
    Current Data:
    ${JSON.stringify(currentCategories, null, 2)}
    
    Output the FULL updated list (kept items + new items) in the target language: ${language}.
    Ensure the JSON structure matches the input.
    `;
    
    const response = await this.ai.models.generateContent({
      model: this.modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: inspirationSchema
      },
    });

    try {
        const textToParse = response.text.replace(/```json\n?|\n?```/g, '').trim();
        const parsed = JSON.parse(textToParse);
        return (parsed.categories || []) as InspirationCategory[];
    } catch (e) {
        console.error("Failed to remix inspiration questions:", e);
        return currentCategories; // Return original on failure
    }
  }
}
