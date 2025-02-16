# Xponder

A modern chat interface that supports multiple AI models through OpenRouter and Ollama, with real-time streaming responses and chat history.

## Features

- 🎨 Clean, modern UI with dark/light mode
- 🤖 Multiple AI Provider Support:
  - OpenRouter (Claude, GPT-4, etc.)
  - Ollama (Local models)
- 💬 Real-time streaming responses
- 📝 Markdown and code syntax highlighting
- 💾 Persistent chat history
- ⚡ Fast and responsive

## Prerequisites

- Node.js 16+
- SQLite (for chat history)
- Ollama (optional, for local models)

## Setup

1. Clone the repository:
```bash
git clone https://github.com/Xpond/llm_chat_interface.git
cd xponder
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Add your OpenRouter API key (if using OpenRouter)
   - Configure Ollama endpoint (if using Ollama)

4. Initialize the database:
```bash
npx prisma generate
npx prisma db push
```

5. Start the backend server:
```bash
npm run server
```

6. Start the development server:
```bash
npm run dev
```

## Configuration

### OpenRouter Setup
1. Get an API key from [OpenRouter](https://openrouter.ai)
2. Add it to your settings in the app
3. Select from available models

### Ollama Setup
1. Install Ollama from [Ollama.ai](https://ollama.ai)
2. Pull your desired models:
```bash
ollama pull mistral
```
3. Ensure Ollama is running
4. Configure the endpoint in settings (default: http://localhost:11434)

## Development

- Frontend: React + TypeScript + Vite
- Styling: Tailwind CSS
- Backend: Express + Prisma
- Database: SQLite

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT
