const statusDiv = document.getElementById('status');
const responsePreviewDiv = document.getElementById('response-preview'); // Для отладки

// ВАЖНО: В продакшене замените '*' на точный origin вашего LMS или хоста курса Storyline
// Например: 'https://your-lms.com' или 'null' если курс запускается локально из файловой системы.
// Для локального тестирования Storyline (HTML5) часто origin будет 'null' или 'file://'.
const PARENT_WINDOW_ORIGIN = '*'; // БУДЬТЕ ОСТОРОЖНЫ С '*' В ПРОДАКШЕНе!

function updateStatus(message) {
    if (statusDiv) statusDiv.textContent = message;
    console.log("Bridge Status:", message);
}

function updateResponsePreview(text) {
    if (responsePreviewDiv) responsePreviewDiv.textContent = text;
}

// 1. Слушаем сообщения от Storyline
window.addEventListener('message', (event) => {
    // ВАЖНО: Проверка Origin для безопасности!
    // if (PARENT_WINDOW_ORIGIN !== '*' && event.origin !== PARENT_WINDOW_ORIGIN) {
    //     updateStatus(`Сообщение от недоверенного источника: ${event.origin}. Игнорируется.`);
    //     return;
    // }

    if (event.data && event.data.type === 'sendPromptToGemini') {
        const prompt = event.data.payload;
        updateStatus(`Получен промпт: "${prompt}". Отправка на бэкенд...`);
        sendPromptToBackend(prompt);
    }
});

// 2. Отправляем промпт на наш бэкенд
async function sendPromptToBackend(prompt, originalParentOrigin) {
    try {
        // ИЗМЕНЕН URL ЗДЕСЬ:
        const response = await fetch('/.netlify/functions/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt: prompt }),
        });

        if (!response.ok) {
            // Попытка прочитать тело ошибки как текст, затем как JSON
            const errorText = await response.text();
            updateStatus(`Ошибка сервера: ${response.status}. Ответ: ${errorText}`);
            console.error("Ошибка сервера:", response.status, errorText);
            try {
                const errorData = JSON.parse(errorText); // Если ошибка вернула JSON
                throw new Error(errorData.error || `Ошибка сервера: ${response.status}`);
            } catch (e) { // Если ошибка не JSON (например, HTML 404 страницы)
                throw new Error(`Ошибка сервера: ${response.status}. Получен не JSON ответ.`);
            }
        }

        const data = await response.json();
        updateStatus('Ответ от бэкенда получен.');
        if (responsePreviewDiv && data.generatedText) responsePreviewDiv.textContent = "AI: " + data.generatedText;
        sendResponseToStoryline(data.generatedText, originalParentOrigin);

    } catch (error) {
        updateStatus(`Ошибка при запросе к бэкенду: ${error.message}`);
        console.error("Ошибка при запросе к бэкенду:", error);
        if (responsePreviewDiv) responsePreviewDiv.textContent = "Ошибка: " + error.message;
        sendResponseToStoryline(`Ошибка: ${error.message}`, originalParentOrigin);
    }
}

// 3. Отправляем ответ от Gemini обратно в Storyline
function sendResponseToStoryline(text) {
    if (window.parent && window.parent !== window) {
        window.parent.postMessage({
            type: 'geminiResponse',
            payload: text
        }, PARENT_WINDOW_ORIGIN); // Используйте тот же origin
        updateStatus('Ответ отправлен в Storyline.');
    } else {
        updateStatus('Не удалось найти родительское окно для отправки ответа.');
    }
}

// Сообщаем, что мост готов (если это нужно Storyline)
updateStatus('Gemini Bridge загружен и готов.');
if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: 'bridgeReady' }, PARENT_WINDOW_ORIGIN);
}