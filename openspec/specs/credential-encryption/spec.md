# Credential Encryption Specification

## Purpose

Credentials for a tenant's target database connection (A2) are enciphered at rest under a master key held outside the application's own database, deciphered only in memory to dial a target, and the process refuses to start when the key is absent or invalid (DEC-16, DEC-17).

## Requirements

### Requirement: Versioned Authenticated Envelope Format

The system SHALL encipher every credential using AES-256-GCM (`node:crypto`), with a random initialization vector (IV) generated per encipher call, and SHALL encode the result as a versioned envelope in the form `v1:iv:tag:ciphertext`, each component base64-encoded.

#### Scenario: Enciphering a credential produces a versioned envelope

- **GIVEN** a plaintext credential and a valid master key
- **WHEN** the credential is enciphered
- **THEN** the result SHALL be a string of the form `v1:iv:tag:ciphertext`

#### Scenario: The same credential enciphers differently each time

- **GIVEN** the same plaintext credential enciphered twice with the same master key
- **WHEN** the two envelopes are compared
- **THEN** they SHALL differ, because each encipher call SHALL use a fresh random IV

### Requirement: Credential Is Enciphered Before It Reaches Storage

The system SHALL encipher a submitted credential before persisting it, so no plaintext credential is ever written to the application's own database.

#### Scenario: Registering a connection stores ciphertext, not plaintext

- **GIVEN** a connection registration request carrying a plaintext credential
- **WHEN** the record is persisted
- **THEN** the stored value SHALL be an enciphered envelope
- **AND** the submitted plaintext value SHALL NOT appear in the stored row

### Requirement: Credential Is Deciphered Only in Memory at a Use Site

The system SHALL decipher a stored credential only at the moment it is needed to dial a target — the connectivity test probe and query execution — and SHALL hold the deciphered value only in memory for that call, never persisting or returning it.

#### Scenario: A deciphered credential is used to dial and then discarded

- **GIVEN** a registered connection with an enciphered credential
- **WHEN** the connectivity test or query execution runs
- **THEN** the stored envelope SHALL be deciphered in memory to open the connection
- **AND** the deciphered value SHALL NOT be persisted anywhere nor included in the response

### Requirement: Fail-Closed Master Key Validation at Boot

The system SHALL read exactly one master key from an environment variable at startup, scoped to the whole deployment (not per tenant). WHEN the key is absent, shorter than required, or otherwise malformed, the process SHALL refuse to start before accepting any request.

#### Scenario: Startup with no master key configured

- **GIVEN** the master key environment variable is unset
- **WHEN** the application starts
- **THEN** the process SHALL exit or refuse to begin serving requests
- **AND** no request SHALL be handled

#### Scenario: Startup with a malformed or too-short master key

- **GIVEN** the master key environment variable is set to a value that is too short or not validly formatted
- **WHEN** the application starts
- **THEN** the process SHALL refuse to start, identically to the absent-key case

### Requirement: Master Key and Deciphered Credential Never Exposed

The system MUST NOT include the master key or any deciphered credential value in any response body, error message, or log line, under any outcome, including a decipher failure caused by a corrupted or tampered envelope.

#### Scenario: A decipher failure does not leak key material or partial plaintext

- **GIVEN** a stored envelope that fails authentication (tampered or corrupted ciphertext)
- **WHEN** the system attempts to decipher it
- **THEN** the failure response and any log line SHALL NOT contain the master key or any plaintext or partial plaintext derived from the envelope
