# Telegram Link Specification (CH-44 delta)

## Purpose
A tenant links one Telegram chat to the platform's global bot with a one-time code, read by polling Telegram outward with no webhook and no inbound port (N5, DEC-185, DEC-196). The link is where `telegram-notification` sends a Telegram automation's notices (N4). This capability itself sends nothing to the chat except the bot's two fixed answers, and never runs an automation.
