"""
TextIQ Twin Display — example Telegram bot host.

Setup:
  pip install python-telegram-bot==21.6
  export BOT_TOKEN=123456:ABC...
  export MINI_APP_URL=https://your-domain.com/index.html
  python bot.example.py
"""

from __future__ import annotations

import json
import os

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, KeyboardButton, ReplyKeyboardMarkup, Update, WebAppInfo
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, filters


BOT_TOKEN = os.environ["BOT_TOKEN"]
MINI_APP_URL = os.environ.get("MINI_APP_URL", "https://example.com/index.html")


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    keyboard = ReplyKeyboardMarkup(
        [[KeyboardButton(text="Open TextIQ", web_app=WebAppInfo(url=MINI_APP_URL))]],
        resize_keyboard=True,
    )
    inline = InlineKeyboardMarkup(
        [[InlineKeyboardButton(text="Launch Twin Display", web_app=WebAppInfo(url=MINI_APP_URL))]]
    )
    await update.message.reply_text(
        "TextIQ Twin Display\n\n"
        "Port A → engine → Port B with probability score.\n"
        "Open from the keyboard button to enable sendData.",
        reply_markup=keyboard,
    )
    await update.message.reply_text("Inline launch:", reply_markup=inline)


async def web_app_data(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    raw = update.effective_message.web_app_data.data
    try:
        data = json.loads(raw)
        otp = data.get("otp", "—")
        score = data.get("score", "—")
        verdict = data.get("verdict", "")
        sender = data.get("sender", "")
        await update.message.reply_text(
            f"TextIQ result\n"
            f"OTP: `{otp}`\n"
            f"Score: *{score}%*\n"
            f"{verdict}\n"
            f"Sender: {sender or '—'}",
            parse_mode="Markdown",
        )
    except json.JSONDecodeError:
        await update.message.reply_text(f"Received: {raw}")


def main() -> None:
    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(MessageHandler(filters.StatusUpdate.WEB_APP_DATA, web_app_data))
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
