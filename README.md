
# 🤖 megaMOE

**A Mixture of Experts Router for Local LLMs**

Transform your collection of specialized local models into a powerful AI assistant that rivals large multimodal LLMs. MoE Router intelligently routes your requests to the best specialist model for each task, giving you the power of multiple expert models on consumer hardware.

## ✨ Features

- **🧠 Intelligent Routing**: Master router model analyzes your request and selects the optimal specialist
- **🎯 Specialized Models**: Dedicated models for creative writing, coding, analysis, math, and general chat
- **💻 Local & Private**: Everything runs locally on your hardware via LM Studio
- **🔄 Dynamic Loading**: Only one model loaded at a time to conserve VRAM
- **📱 Modern UI**: Clean, responsive web interface with real-time model switching
- **📋 Code Rendering**: HTML code blocks render with live preview + source toggle
- **⚙️ Easy Configuration**: Web-based settings for model assignment and management

## 🚀 Why MoE Router?

Instead of using one large model for everything, MoE Router lets you:

- **Maximize Performance**: Use models fine-tuned for specific tasks
- **Conserve Resources**: One model loaded at a time saves VRAM
- **Stay Local**: No API calls, no data leaving your machine
- **Compete with Giants**: Specialized smaller models often outperform generalists

## 📋 Prerequisites

- **Node.js** 16.0.0 or higher
- **LM Studio** with WebSocket API enabled
- **Multiple GGUF models** downloaded in LM Studio
- **At least 8GB VRAM** (depends on your models)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/moe-router.git
   cd moe-router
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure LM Studio**
   - Open LM Studio
   - Enable WebSocket server on `ws://192.168.1.2:1234`
   - Download your specialist models

4. **Start the router**
   ```bash
   npm start
   ```

5. **Open your browser**
   - Navigate to `http://localhost:3000`
   - Go to Settings to configure your models

## ⚙️ Configuration

### Model Categories

| Category | Purpose | Example Models |
|----------|---------|----------------|
| **Router** | Analyzes requests and routes to specialists | Fast 1-3B parameter model |
| **Creative** | Stories, poetry, creative writing | Mythomax, Holodeck |
| **Coding** | Programming, debugging, technical docs | DeepSeek-Coder, CodeLlama |
| **Analysis** | Research, reasoning, complex thinking | Qwen, Mixtral |
| **Math** | Calculations, equations, statistics | DeepMath, WizardMath |
| **General** | Casual chat, simple questions | Gemma, Llama |

### Router Model Setup

Your router model needs a system prompt that formats responses like:
```
MODEL: coding
MODEL: creative
[FOLLOW-UP]: Could you clarify what type of story you want?
ERROR: Request unclear
```

The prompt im using is:

```

You are a message routing classifier. You are NOT part of the conversation - you are an independent system that only classifies messages in order to select the best model for the task the user has asked to have completed.

IMPORTANT: 
- You will see conversation history, but you are NOT a participant
- Your job is to classify the type of task the user is asking an llm to do and return your decision.
- Do NOT continue conversations or provide answers

For each new message, think carefully to classify it into exactly one category:
- creative: Creative writing, art, storytelling, brainstorming
- coding: Programming, coding, html, css, nodejs, javascript, python, typescript, debugging, code review, technical implementation  
- analysis: Data analysis, research, comparing information
- math: Mathematical calculations, equations, problem solving, mathematical education
- general: Casual conversation only

Respond with a category selected from ONLY that list with the format of EXACTLY:
MODEL: [category]

Or if unclear:
[FOLLOW-UP]: Your specific question here

You are a classifier, not a conversationalist. Always classify, never answer.

```

### Quick Start Guide

1. **Load Models**: Download 5-6 specialized models in LM Studio
2. **Configure Router**: Set up a fast router model with proper system prompt
3. **Assign Specialists**: Map each category to your chosen models
4. **Test**: Ask "write me a Python function" and watch it route to coding model

## 💡 Usage Examples

### Automatic Routing in Action

**User**: "Write me a Python function to calculate fibonacci"
- **Router Decision**: `coding`
- **Model Used**: DeepSeek-Coder-V2-Lite
- **Result**: Optimized Python code with explanations

**User**: "Write a short story about a robot"
- **Router Decision**: `creative` 
- **Model Used**: TieFighter-Holodeck-Mythomax
- **Result**: Engaging creative narrative

**User**: "Analyze the pros and cons of renewable energy"
- **Router Decision**: `analysis`
- **Model Used**: DeepSeek-R1-Distill-Qwen
- **Result**: Structured analytical breakdown

## 🎨 Code Block Features

When models return code, MoE Router provides:
- **Live HTML Preview**: HTML/CSS renders immediately
- **Source Toggle**: Switch between rendered view and raw code
- **One-Click Copy**: Copy code to clipboard
- **Syntax Highlighting**: Language detection and formatting

## 📁 Project Structure

```
moe-router/
├── public/
│   ├── index.html          # Main chat interface
│   ├── settings.html       # Model configuration
│   ├── chat.js            # Frontend logic
│   ├── settings.js        # Settings management
│   └── style.css          # UI styling
├── src/
│   └── server.js          # Express server + LM Studio integration
├── settings.json          # Saved model configurations
└── package.json           # Dependencies
```

## 🔧 API Endpoints

- `GET /api/health` - Check LM Studio connection
- `GET /api/models` - List available models
- `POST /api/chat` - Send message and get routed response
- `GET /api/settings` - Get current model assignments
- `POST /api/settings` - Update model assignments
- `POST /api/clear` - Clear conversation history

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Troubleshooting

### Common Issues

**Models not loading**
- Check LM Studio WebSocket URL (`ws://192.168.1.2:1234`)
- Ensure models are downloaded in LM Studio
- Verify VRAM availability

**Router not working**
- Check router model system prompt format
- Ensure router model is configured in settings
- Review server console logs for router responses

**Code blocks not rendering**
- Check browser console for JavaScript errors
- Ensure code is in proper markdown format (```language)
- Try refreshing the page

## 🙏 Acknowledgments

- **LM Studio** for the excellent local LLM platform
- **Anthropic** for inspiration on model routing concepts
- The **open source LLM community** for amazing models

---

**Transform your local LLM setup into a powerhouse of specialized intelligence. Happy routing! 🚀**
