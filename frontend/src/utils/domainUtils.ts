/**
 * Extracts the base domain from a license server URL (e.g. 'https://api.tefatjkt.net' -> 'tefatjkt.net')
 * Defaults to 'absenta.id' if no URL is provided or if parsing fails.
 */
export function getBaseDomain(licenseServerUrl: string | undefined): string {
  if (!licenseServerUrl) return 'absenta.id';
  try {
    // Remove protocol
    let host = licenseServerUrl.replace(/^https?:\/\//i, '');
    // Remove port if any
    host = host.split(':')[0];
    // Remove trailing slashes or paths
    host = host.split('/')[0];
    // Remove leading 'api.'
    if (host.toLowerCase().startsWith('api.')) {
      host = host.substring(4);
    }
    return host || 'absenta.id';
  } catch (e) {
    return 'absenta.id';
  }
}
