import { BiometricType } from '@prisma/client';

/**
 * BiometricProvider is the contract every biometric backend must satisfy —
 * whether that's a fingerprint SDK (e.g. SecuGen, ZKTeco), a facial
 * recognition service (e.g. AWS Rekognition, a local FaceNet model), or,
 * during development / hardware unavailability, the fallback below.
 *
 * IMPORTANT: This system does not implement mock biometric *verification
 * logic* in the sense of pretending to match fingerprints/faces. What it
 * does provide is an explicit, clearly-labeled fallback check-in method
 * (QR code + one-time token) that is recorded as its own verification
 * method (VerificationMethod.QR_FALLBACK) — never conflated with an actual
 * biometric match. Attendance records always say truthfully how a student
 * was verified.
 *
 * To integrate a real biometric SDK:
 *   1. Implement this interface in a new file under services/biometric/
 *      (e.g. SecuGenFingerprintProvider.ts, RekognitionFaceProvider.ts).
 *   2. Register it in biometricProviderRegistry below.
 *   3. No controller, route, or attendance-capture logic needs to change —
 *      they depend only on this interface.
 */
export interface EnrollmentResult {
  success: boolean;
  externalTemplateId?: string; // opaque reference to the vendor-stored template
  message: string;
}

export interface VerificationResult {
  success: boolean;
  matchedStudentId?: string;
  confidence?: number; // 0-1, provider-defined
  message: string;
}

export interface BiometricProvider {
  readonly type: BiometricType;

  /** Enroll a student's biometric template with the underlying provider/SDK. */
  enroll(studentId: string, rawSample: unknown): Promise<EnrollmentResult>;

  /** Verify a live sample against a previously enrolled template. */
  verify(studentId: string, liveSample: unknown): Promise<VerificationResult>;
}

/**
 * NotConfiguredProvider is the explicit, honest default for both
 * FINGERPRINT and FACIAL until real hardware/SDK integration is wired in.
 * It never claims success — it fails loudly and clearly, by design, so
 * that nobody mistakes an unconfigured system for a working one.
 */
class NotConfiguredProvider implements BiometricProvider {
  constructor(public readonly type: BiometricType) {}

  async enroll(): Promise<EnrollmentResult> {
    return {
      success: false,
      message: `${this.type} enrollment is not available: no biometric SDK is configured. ` +
        `Use QR fallback check-in until hardware/SDK integration is complete, or implement a ` +
        `BiometricProvider for ${this.type} and register it in biometricProviderRegistry.`,
    };
  }

  async verify(): Promise<VerificationResult> {
    return {
      success: false,
      message: `${this.type} verification is not available: no biometric SDK is configured.`,
    };
  }
}

export const biometricProviderRegistry: Record<BiometricType, BiometricProvider> = {
  FINGERPRINT: new NotConfiguredProvider('FINGERPRINT'),
  FACIAL: new NotConfiguredProvider('FACIAL'),
};

export function getBiometricProvider(type: BiometricType): BiometricProvider {
  return biometricProviderRegistry[type];
}
