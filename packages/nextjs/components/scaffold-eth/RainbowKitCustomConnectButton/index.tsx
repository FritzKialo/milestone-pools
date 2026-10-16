"use client";

import { useEffect, useState } from "react";
import { AddressInfoDropdown } from "./AddressInfoDropdown";
import { AddressQRCodeModal } from "./AddressQRCodeModal";
import { useAppKit } from "@reown/appkit/react";
import { Balance } from "@scaffold-ui/components";
import { getBlockExplorerAddressLink } from "@scaffold-ui/hooks";
import { Address } from "viem";
import { useAccount } from "wagmi";
import { useNetworkColor } from "~~/hooks/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";

/**
 * Connect button. Opens the wallet window (email, browser wallets, QR code for mobile wallets).
 * Once connected it shows the address menu on any network; the balance shows on the app's own network.
 */
export const RainbowKitCustomConnectButton = () => {
  const networkColor = useNetworkColor();
  const { targetNetwork } = useTargetNetwork();
  const { open } = useAppKit();
  const { address, chain, isConnected } = useAccount();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || !isConnected || !address) {
    return (
      <button className="btn btn-primary btn-sm" onClick={() => open({ view: "Connect" })} type="button">
        Connect Wallet
      </button>
    );
  }

  const onTarget = !!chain && chain.id === targetNetwork.id;
  const blockExplorerAddressLink = getBlockExplorerAddressLink(targetNetwork, address);

  return (
    <>
      <div className="hidden sm:flex flex-col items-center mr-2">
        {onTarget && (
          <Balance
            address={address as Address}
            style={{
              minHeight: "0",
              height: "auto",
              fontSize: "0.8em",
            }}
          />
        )}
        <span className="text-xs" style={{ color: onTarget ? networkColor : undefined }}>
          {chain?.name ?? "Unknown network"}
        </span>
      </div>
      <AddressInfoDropdown
        address={address as Address}
        displayName={address}
        blockExplorerAddressLink={blockExplorerAddressLink}
      />
      <AddressQRCodeModal address={address as Address} modalId="qrcode-modal" />
    </>
  );
};
