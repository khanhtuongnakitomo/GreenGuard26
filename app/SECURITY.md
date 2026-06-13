# Security

## Sensitive Data

Never commit `.env` files, database credentials, JWT secrets, machine API keys, OTPs, QR tokens, or generated voucher tokens.

## Authentication

The backend issues JWT access and refresh tokens. Responses must never expose password hashes, OTP hashes, machine API key hashes, claim token hashes, or voucher QR token hashes.

## Reporting Issues

Report security issues privately to the project maintainers. Include the affected route, expected behavior, observed behavior, and reproduction steps when possible.
