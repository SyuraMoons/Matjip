const DEFAULT_PUBLIC_GATEWAY = "https://ipfs.io/ipfs";

function gatewayBaseUrl() {
  return (process.env.NEXT_PUBLIC_GATEWAY_URL || DEFAULT_PUBLIC_GATEWAY).replace(
    /\/$/,
    ""
  );
}

export function ipfsToGatewayUrl(uri: string) {
  if (!uri.startsWith("ipfs://")) {
    return uri;
  }

  const cidPath = uri.replace("ipfs://", "").replace(/^\/+/, "");
  return `${gatewayBaseUrl()}/${cidPath}`;
}
