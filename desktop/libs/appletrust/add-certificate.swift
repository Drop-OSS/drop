import Foundation
import Security

enum SecurityError: Error {
    case generalError
}

func deleteCertificateFromKeyChain(_ certificateLabel: String) -> Bool {
    let delQuery: [NSString: Any] = [
        kSecClass: kSecClassCertificate,
        kSecAttrLabel: certificateLabel,
    ]
    let delStatus: OSStatus = SecItemDelete(delQuery as CFDictionary)

    return delStatus == errSecSuccess
}

/// Saves a certificate to the system keychain with the specified label and applies administrative trust settings.
/// - Parameters:
///   - certificate: The certificate to save.
///   - certificateLabel: The label assigned to the certificate.
/// - Throws: `SecurityError.generalError` if the certificate cannot be added to the keychain.
func saveCertificateToKeyChain(_ certificate: SecCertificate, certificateLabel: String) throws {
    SecKeychainSetPreferenceDomain(SecPreferencesDomain.system)
    deleteCertificateFromKeyChain(certificateLabel)

    let setQuery: [NSString: AnyObject] = [
        kSecClass: kSecClassCertificate,
        kSecValueRef: certificate,
        kSecAttrLabel: certificateLabel as AnyObject,
        kSecAttrAccessible: kSecAttrAccessibleWhenUnlocked,
        kSecAttrCanSign: true as AnyObject,
    ]
    let addStatus: OSStatus = SecItemAdd(setQuery as CFDictionary, nil)

    guard addStatus == errSecSuccess else {
        throw SecurityError.generalError
    }

    let trustStatus: OSStatus = SecTrustSettingsSetTrustSettings(certificate, SecTrustSettingsDomain.admin, nil)

    guard trustStatus == errSecSuccess else {
        throw SecurityError.generalError
    }
}

/// Creates a security certificate from a Base64-encoded string.
/// - Parameter stringData: The Base64-encoded certificate data.
/// - Returns: The decoded security certificate.
/// - Throws: `SecurityError.generalError` if the string cannot be decoded into a certificate.
func getCertificateFromString(stringData: String) throws -> SecCertificate {
    if let data = NSData(base64Encoded: stringData, options: NSData.Base64DecodingOptions.ignoreUnknownCharacters),
       let certificate = SecCertificateCreateWithData(kCFAllocatorDefault, data) {
        return certificate
    }
    throw SecurityError.generalError
}

if CommandLine.arguments.count != 2 {
    print("Usage: \(CommandLine.arguments[0]) [cert.file]")
    print("Usage: \(CommandLine.arguments[0]) --version")
    exit(1)
}

if (CommandLine.arguments[1] == "--version") {
    let version = "dev"
    print(version)
    exit(0)
} else {
    let fileURL = URL(fileURLWithPath: CommandLine.arguments[1])
    do {
        let certData = try Data(contentsOf: fileURL)
        let certificate = SecCertificateCreateWithData(nil, certData as CFData)
        if certificate != nil {
            try? saveCertificateToKeyChain(certificate!, certificateLabel: "DropOSS")
            exit(0)
        } else {
            print("ERROR: Unknown error while reading the \(CommandLine.arguments[1]) file.")
        }
    } catch {
        print("ERROR: Unexpected error while reading the \(CommandLine.arguments[1]) file. \(error)")
    }
}
exit(1)