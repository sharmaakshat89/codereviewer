import { GoogleGenAI, Type } from "@google/genai";// TPE :  tool to define schema 
import 'dotenv/config';
import fs from 'fs';
import path from 'path';

// npm i fs
//  npm i path

const ai = new GoogleGenAI({});

// ============================================
// TOOL FUNCTIONS
// ============================================

async function listFiles({ directory }) { //scans all files in the folder , collects files with a specific extention and returns them in an array
  const files = []; //stores all matching file paths
  const extensions = ['.js', '.jsx', '.ts', '.tsx', '.html', '.css']; //allowed file extensions
  
  function scan(dir) {
    const items = fs.readdirSync(dir); //returns all the files in the directory in an array
    
    for (const item of items) {
      const fullPath = path.join(dir, item); //joins the file path
      
      // Skip node_modules, dist, build
      if (fullPath.includes('node_modules') || 
          fullPath.includes('dist') || 
          fullPath.includes('build')) continue; // skip and continue to next itme in loop if these words come
      
      const stat = fs.statSync(fullPath); //tells whether fullPath is a file or a folder and its size
      
      if (stat.isDirectory()) {
        scan(fullPath); // if it is a folder then run scan func on it too
      } else if (stat.isFile()) { // if it is a file
        const ext = path.extname(item); //then take out its extension name
        if (extensions.includes(ext)) { // check if that extention is allowed 
          files.push(fullPath); // if yes then push in files array
        }
      }
    }
  }
  
  scan(directory);
  console.log(`Found ${files.length} files`);
  return { files };
}

// User deta hai: { directory: "./src" }

// files = [] ban jaata hai

// scan("./src") call hota hai

// Folder ke andar ke items milte hain

// Har item check hota hai:

// Agar banned folder hai → skip

// Agar folder hai → andar jao (recursion)

// Agar file hai → extension check karo

// Agar extension allowed hai → files array me push

// End me files return

async function readFile({ file_path }) {
  const content = fs.readFileSync(file_path, 'utf-8'); // File ka text → content variable me store ho gaya.
  console.log(`Reading: ${file_path}`);
  return { content }; // short  for : return { content: content };
}
//Flow:

// File read hoti hai

// Content string milti hai

// Console log hota hai

// { content: "file ka text" } return hota hai


async function writeFile({ file_path, content }) {
  fs.writeFileSync(file_path, content, 'utf-8'); // fs.writeFileSync(path, data, encoding)
  console.log(`✍️  Fixed: ${file_path}`);
  return { success: true };
}

// ============================================
// TOOL REGISTRY
// ============================================

const tools = {
  'list_files': listFiles,
  'read_file': readFile,
  'write_file': writeFile
};

// ============================================
// TOOL DECLARATIONS
// ============================================

const listFilesTool = {
  name: "list_files",
  description: "Get all JavaScript files in a directory",
  parameters: {
    type: Type.OBJECT,
    properties: {
      directory: {
        type: Type.STRING,
        description: "Directory path to scan"
      }
    },
    required: ["directory"]
  }
};

const readFileTool = {
  name: "read_file",
  description: "Read a file's content",
  parameters: {
    type: Type.OBJECT,
    properties: {
      file_path: {
        type: Type.STRING,
        description: "Path to the file"
      }
    },
    required: ["file_path"]
  }
};

const writeFileTool = {
  name: "write_file",
  description: "Write fixed content back to a file",
  parameters: {
    type: Type.OBJECT,
    properties: {
      file_path: {
        type: Type.STRING,
        description: "Path to the file to write"
      },
      content: {
        type: Type.STRING,
        description: "The fixed/corrected content"
      }
    },
    required: ["file_path", "content"]
  }
};

// ============================================
// MAIN FUNCTION
// ============================================

export async function runAgent(directoryPath) {
  console.log(`🔍 Reviewing: ${directoryPath}\n`);

  const History = [{
    role: 'user',
    parts: [{ text: `Review and fix all JavaScript code in: ${directoryPath}` }]
  }];

  while (true) {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: History,
      config: {
        systemInstruction: `You are an expert JavaScript code reviewer and fixer.

**Your Job:**
1. Use list_files to get all HTML, CSS, JavaScript, and TypeScript files in the directory
2. Use read_file to read each file's content
3. Analyze for:
   
   **HTML Issues:**
   - Missing doctype, meta tags, semantic HTML
   - Broken links, missing alt attributes
   - Accessibility issues (ARIA, roles)
   - Inline styles that should be in CSS
   
   **CSS Issues:**
   - Syntax errors, invalid properties
   - Browser compatibility issues
   - Inefficient selectors
   - Missing vendor prefixes
   - Unused or duplicate styles
   
   **JavaScript Issues:**
   - BUGS: null/undefined errors, missing returns, type issues, async problems
   - SECURITY: hardcoded secrets, eval(), XSS risks, injection vulnerabilities
   - CODE QUALITY: console.logs, unused code, bad naming, complex logic

4. Use write_file to FIX the issues you found (write corrected code back)
5. After fixing all files, respond with a summary report in TEXT format

**Summary Report Format:**
📊 CODE REVIEW COMPLETE

Total Files Analyzed: X
Files Fixed: Y

🔴 SECURITY FIXES:
- file.js:line - Fixed hardcoded API key
- auth.js:line - Removed eval() usage

🟠 BUG FIXES:
- app.js:line - Added null check for user object
- index.html:line - Added missing alt attribute

🟡 CODE QUALITY IMPROVEMENTS:
- styles.css:line - Removed duplicate styles
- script.js:line - Removed console.log statements

Be practical and focus on real issues. Actually FIX the code, don't just report.`,
        tools: [{
          functionDeclarations: [listFilesTool, readFileTool, writeFileTool]
        }] // telling gemini we have these three tools that use those 3 functions
      }
    });

    // Process ALL function calls at once
    if (result.functionCalls?.length > 0) { // if model has called any function then result will come in result.functionCalls
      // for ex result.functionCalls = [ { name : 'list_files' , args : { directory : './src' } } ]
      // Execute all function calls
      for (const functionCall of result.functionCalls) { // process each fnc loop
        
        const { name, args } = functionCall; //getting name and args of fnc to be called
        
        console.log(`📌 ${name}`);

        const toolResponse = await tools[name](args);

        // Add function call to history
        History.push({
          role: "model",
          parts: [{ functionCall }]
        });

        // Add function response to history
        History.push({
          role: "user",
          parts: [{
            functionResponse: {
              name,
              response: { result: toolResponse }
            }
          }]
        });
      }
      
    } else {
      console.log('\n' + result.text);
      break;
    }
  }
}

// node agent.js ../tester

const directory = process.argv[2] || '.';

await runAgent(directory);

// User: Review and fix code in ./project

// Model: (calls list_files)

// User: Here is result of list_files → { files: [...] }

// Model: (calls read_file)

// User: Here is result of read_file → { content: "..." }

// Model: (calls write_file)

// User: Here is result of write_file → { success: true }

// Model: 📊 CODE REVIEW COMPLETE ...