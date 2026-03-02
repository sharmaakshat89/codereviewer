// ==============================
// STEP 1: IMPORTS
// ==============================

import { GoogleGenAI, Type } from "@google/genai"; 
// GoogleGenAI → talks to Gemini
// Type → helps define tool parameters

import readlineSync from "readline-sync"; 
// Lets us ask questions in terminal

import "dotenv/config"; 
// Loads environment variables from .env

// ==============================
// STEP 2: INITIAL SETUP
// ==============================

const ai = new GoogleGenAI({}); 
// Creates AI instance (API key auto-read from .env)

const History = []; 
// Stores full conversation history
// This is what gets sent to Gemini each time


// ==============================
// STEP 3: WRITE REAL FUNCTIONS (YOUR TOOLS)
// ==============================

// These are normal JS functions.
// They do real-world work (API call, DB call, file system, etc.)

async function exampleTool({ input }) {
  // You can replace this logic with anything
  return `You sent: ${input}`;
}


// ==============================
// STEP 4: DESCRIBE TOOL FOR LLM
// ==============================

// IMPORTANT:
// We are NOT passing the function.
// We are only describing it so Gemini knows:
// - What it does
// - What input it needs

const exampleToolInfo = {
  name: "exampleTool",  // Must match actual function name
  description: "Takes user input and returns it back.",
  parameters: {
    type: Type.OBJECT, // Tool expects an object
    properties: {
      input: {
        type: Type.STRING,
        description: "Any string provided by user"
      }
    },
    required: ["input"] // This parameter is mandatory
  }
};


// ==============================
// STEP 5: REGISTER TOOLS
// ==============================

// Tell Gemini which tools exist

const tools = [
  {
    functionDeclarations: [exampleToolInfo]
  }
];


// ==============================
// STEP 6: MAP TOOL NAME TO REAL FUNCTION
// ==============================

// This connects:
// Gemini's decision → Actual JS function execution

const toolFunctions = {
  exampleTool: exampleTool
};


// ==============================
// STEP 7: CORE AGENT LOOP
// ==============================

async function runAgent() {

  while (true) {

    // Send entire conversation to Gemini
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: History,
      config: { tools }
    });

    // ==========================================
    // CASE 1: Gemini wants to call a function
    // ==========================================

    if (result.functionCalls && result.functionCalls.length > 0) {

      const functionCall = result.functionCalls[0];
      const { name, args } = functionCall;

      // Execute the actual JS function
      const toolResult = await toolFunctions[name](args);

      // Prepare tool result in Gemini-compatible format
      const functionResponsePart = {
        name: name,
        response: { result: toolResult }
      };

      // Log that model requested a function
      History.push({
        role: "model",
        parts: [{ functionCall }]
      });

      // Send tool result back as "user"
      // This tells Gemini:
      // "Here is the result of what you asked to run"
      History.push({
        role: "user",
        parts: [{ functionResponse: functionResponsePart }]
      });

    }

    // ==========================================
    // CASE 2: Gemini gives final text response
    // ==========================================

    else {

      console.log("\nAI:", result.text);

      History.push({
        role: "model",
        parts: [{ text: result.text }]
      });

      break; // Exit loop after final answer
    }
  }
}


// ==============================
// STEP 8: USER INPUT LOOP
// ==============================

while (true) {

  const question = readlineSync.question("\nAsk: ");

  if (question === "exit") break;

  // Push user message to history
  History.push({
    role: "user",
    parts: [{ text: question }]
  });

  await runAgent();
}


// User types message
//         ↓
// History.push(user message)
//         ↓
// Gemini receives History
//         ↓
// Gemini decides:

//     OPTION A → "I need a tool"
//         ↓
//     Returns:
//     { name: "toolName", args: {...} }
//         ↓
//     Your JS executes real function
//         ↓
//     You send result back to Gemini
//         ↓
//     Gemini converts result into sentence
//         ↓
//     Final answer printed

// OR

//     OPTION B → Direct text response
//         ↓
//     Print result.text
//
// end of note