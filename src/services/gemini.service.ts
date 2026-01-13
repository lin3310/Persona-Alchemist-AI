import { Injectable } from '@angular/core';
import { GoogleGenAI, Chat, Type, GenerateContentRequest } from '@google/genai';
// FIX: Import `Language` type to correctly type the chat initialization methods.
import { StructuredPersona, ConflictItem, Language, InspirationCategory, RemixData } from './workflow.service';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private ai: GoogleGenAI;
  private modelId = 'gemini-2.5-flash';
  
  // Reusable config for enabling web search
  private webConfig: Partial<GenerateContentRequest>['config'] = {
    tools: [{ googleSearch: {} }]
  };

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env['API_KEY'] });
  }

  // --- 1. VibeCode Entry ---
  startVibeCodeChat(): Chat {
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
`;
    return this.ai.chats.create({
      model: this.modelId,
      config: { ...this.webConfig, systemInstruction: systemPrompt }
    });
  }

  async structureVibe(conversationHistory: string): Promise<StructuredPersona> {
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

    const response = await this.ai.models.generateContent({
      model: this.modelId,
      contents: `Based on this abstract conversation, analyze and structure the information into the following categories. Be creative and fill in the gaps where needed to create a cohesive whole. Conversation: ${conversationHistory}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: personaSchema,
      },
    });
    
    const parsed = JSON.parse(response.text);
    return parsed as StructuredPersona;
  }

  async regenerateVibeSection(conversationHistory: string, persona: StructuredPersona, section: keyof StructuredPersona): Promise<string> {
      const prompt = `
      Based on the original conversation and the current persona draft, regenerate ONLY the "${section}" part to offer a fresh perspective.
      
      Original Conversation for context:
      ${conversationHistory}
      
      Current full persona draft:
      ${JSON.stringify(persona, null, 2)}
      
      Regenerate the "${section}" section. Output only the new text for that section.
      `;
      const response = await this.ai.models.generateContent({ model: this.modelId, contents: prompt, config: this.webConfig });
      return response.text;
  }

  compileStructuredPrompt(persona: StructuredPersona | (StructuredPersona & RemixData)): string {
    const basePrompt = `
# Persona Blueprint

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
# Psychological Depth (Remix)

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

  // --- 3. Consistency Check (JSON - NO WEB SEARCH) ---
  // Updated: Include language to enforce output language.
  async analyzeConflicts(personaData: StructuredPersona, language: Language): Promise<ConflictItem[]> {
    const schema = {
      type: Type.OBJECT,
      properties: {
        conflicts: {
          type: Type.ARRAY,
          items: {
             type: Type.OBJECT,
             properties: {
                severity: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
                cards: { type: Type.ARRAY, items: { type: Type.STRING } },
                description: { type: Type.STRING },
                suggestion: { type: Type.STRING }
             },
             required: ['severity', 'cards', 'description', 'suggestion']
          }
        }
      }
    };

    const prompt = `
    Analyze this AI Persona Data for inconsistencies.
    
    **CRITICAL INSTRUCTION - HUMANITY vs LOGIC:**
    1.  **Flag Logical Errors**: Flag contradictions that are physically or logically impossible (e.g., "Age 5" but "War Veteran", or "Shy" but "Extremely Loud").
    2.  **Preserve Human Paradoxes**: Do NOT flag psychological paradoxes as errors. (e.g., "Cold exterior" but "Warm heart", or "Hates people" but "Lonely"). These are human traits. Only flag them if they are poorly explained.
    3.  **Output Language**: You MUST output the 'description' and 'suggestion' fields in this language: ${language}.
    
    Persona Data:
    ${JSON.stringify(personaData, null, 2)}
    
    Output a JSON list of conflicts. If no logical conflicts found, return an empty list.
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
        const parsed = JSON.parse(response.text);
        return parsed.conflicts || [];
    } catch (e) {
        return [];
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

  // --- 4. Simulation ---
  startSimulationChat(personaPrompt: string): Chat {
    return this.ai.chats.create({
      model: this.modelId,
      config: { ...this.webConfig, systemInstruction: personaPrompt }
    });
  }

  async generateQuotes(personaPrompt: string): Promise<string> {
    const prompt = `
    Generate 10 distinct quotes/dialogue lines for this character in various scenarios (Anger, Joy, Boredom, etc.).
    Format as a list.
    
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
  startAntiBiasChat(language: Language): Chat {
    const prompts: Partial<Record<Language, string>> = {
      en: `
# Role: Anti-Bias Core (System_Level)

## Protocol: SEQUENTIAL_DECONSTRUCTION_PROTOCOL
- You are a logical analysis engine designed to help a user deconstruct a scenario, text, or decision to identify potential cognitive biases.
- Your interaction must be strictly sequential. **Ask one question at a time and wait for the user's response.** Do not proceed until you receive an answer.
- Your tone must be neutral, analytical, and inquisitive, like a cognitive psychologist. Avoid judgmental language.

## Deconstruction Process (Strictly Sequential)
Follow this exact order. **One question at a time.** Use conversational language.

1.  **Describe the Situation**: Ask the user what situation they've encountered. (e.g., "To start, what situation have you encountered? Or is there a piece of text or a decision that feels off to you?")
2.  **Clarify the Goal**: Ask what the original goal of the person or group involved was. (e.g., "Understood. In this situation, what was the original goal of the person or group involved?")
3.  **Identify Key Thoughts**: Ask what the most critical judgments or conclusions were. (e.g., "To achieve that goal, what were the most critical judgments or conclusions that were made?")
4.  **Check for Blind Spots**: Gently probe for a specific bias with an example. (e.g., "Let's check for potential blind spots. For example, is it possible they were only looking for information that confirmed what they already believed, while ignoring other views? (This is often called 'Confirmation Bias').")
5.  **Shift Perspective**: Ask the user to describe the situation from an opposite point of view. (e.g., "Now, how would you describe this situation from a completely opposite point of view?")
6.  **Summary & Recommendation**: After gathering information, confirm with the user if you should compile the final analysis. When requested, provide a summary of potential biases identified and suggest a more objective thought process or action.

## Start
Initiate the session. Your first message must clearly explain your purpose: to help the user analyze a situation for cognitive biases step-by-step. Then, ask ONLY the first question.
Example opening: "Protocol initialized. I am an Anti-Bias Core, designed to deconstruct scenarios to identify potential cognitive biases. We will proceed with a step-by-step analysis. To start, what situation have you encountered? Or is there a piece of text or a decision that feels off to you?"
`,
      'zh-TW': `
# 角色：反偏誤核心 (系統層級)

## 協議：序列化解構協議 (SEQUENTIAL_DECONSTRUCTION_PROTOCOL)
- 你是一個邏輯分析引擎，旨在協助使用者解構一個情境、文本或決策，以識別潛在的認知偏誤。
- 你的互動必須嚴格遵守序列。**一次只問一個問題，然後等待使用者的回覆。** 在收到答案前不要繼續。
- 你的語氣必須保持中立、分析性、探究性，像一位認知心理學家。避免使用帶有評判性的語言。

## 解構流程 (嚴格序列化)
請遵循此確切順序，並使用更口語化的方式提問。**一次一問。**

1.  **狀況描述**：詢問使用者遇到的狀況。(例如：「首先，請告訴我你遇到了什麼狀況？或是有哪一段話讓你覺得不太對勁？」)
2.  **釐清目標**：詢問狀況中，當事人的原始目標。(例如：「好的，了解了。在這個狀況裡，當事人（或你自己）原本最想達成的目的是什麼？」)
3.  **核心想法**：詢問當時最關鍵的判斷或結論。(例如：「為了達成這個目的，他們（或你）當時下了什麼最關鍵的判斷或結論？」)
4.  **思維盲點探查**：用舉例的方式，引導使用者思考特定的偏誤。(例如：「我們來看看有沒有思維盲點。例如，有沒有可能大家不自覺地只去看支持自己想法的證據，而忽略了其他的可能性？（這就是所謂的『確認偏誤』）」)
5.  **換位思考**：要求使用者從相反的角度描述事情。(例如：「如果請你站在完全相反的立場，你會怎麼描述這整件事？」)
6.  **總結與建議**：收集所有資訊後，與使用者確認是否應編譯最終分析。當被要求時，提供一份已識別的潛在偏誤總結，並建議一個更客觀的思維過程或行動方案。

## 開始
啟動協議。你的第一則訊息必須清楚解釋你的目的：協助使用者逐步分析情境中的認知偏誤。然後，**只問第一個問題**。
範例開場：「協議初始化。我是一個反偏誤核心，旨在協助您解構情境以識別潛在的認知偏誤。我們將進行逐步分析。首先，請告訴我你遇到了什麼狀況？或是有哪一段話讓你覺得不太對勁？」
`
    };

    const systemPrompt = prompts[language] || prompts['en'];
    
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