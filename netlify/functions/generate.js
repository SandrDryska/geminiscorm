// netlify/functions/generate.js
// или /api/generate.js для Vercel

// Используйте import для ES Modules (если настроен package.json type="module")
// import fetch from 'node-fetch'; // для Node.js < 18
// import { GoogleGenerativeAI } from "@google/generative-ai";

// Или require для CommonJS (по умолчанию для многих serverless environments)
const fetch = require('node-fetch'); // для Node.js < 18, в Node 18+ fetch глобальный
const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("GEMINI_API_KEY не установлен!");
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'API ключ не сконфигурирован на сервере.' }),
        };
    }

    let prompt;
    try {
        const body = JSON.parse(event.body);
        prompt = body.prompt;
        if (!prompt) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Промпт не предоставлен в теле запроса.' }),
            };
        }
    } catch (e) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Некорректный JSON в теле запроса.' }),
        };
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-pro" }); // Или другая подходящая модель

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                // "Access-Control-Allow-Origin": "*", // Настройте CORS, если нужно для локальной разработки
            },
            body: JSON.stringify({ generatedText: text }),
        };
    } catch (error) {
        console.error('Ошибка при вызове Gemini API:', error);
        let errorMessage = 'Не удалось сгенерировать ответ от AI.';
        if (error.message) {
            errorMessage += ` Детали: ${error.message}`;
        }
        // Проверка на specific API errors, если нужно
        // if (error.response && error.response.data && error.response.data.error) {
        //   errorMessage = `Gemini API Error: ${error.response.data.error.message}`;
        // }

        return {
            statusCode: 500,
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ error: errorMessage }),
        };
    }
};