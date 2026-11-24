"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiClient } from "@/components/app/api-client";
import type { ContractDetailDto, OnchainTxDto, UserRole } from "@/domain/dto";

const MAX_POLLS = 15;

export function useContractDetail(id: string, role: UserRole) {
  const [contract, setContract] = useState<ContractDetailDto | null>(null);
  const [onchainTxs, setOnchainTxs] = useState<OnchainTxDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollCountRef = useRef(0);

  const queryRole = role === "TENANT" ? "TENANT" : "LANDLORD";

  const loadContract = useCallback(async () => {
    try {
      const data = await apiClient.getContractById(id, queryRole);
      setContract(data);
      const txs = await apiClient.getOnchainTxs(id);
      setOnchainTxs(txs);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không tìm thấy hợp đồng");
    } finally {
      setLoading(false);
    }
  }, [id, queryRole]);

  useEffect(() => {
    let ignore = false;
    apiClient
      .getContractById(id, queryRole)
      .then(async (data) => {
        if (!ignore) {
          setContract(data);
          const txs = await apiClient.getOnchainTxs(id);
          if (!ignore) {
            setOnchainTxs(txs);
            setLoading(false);
          }
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Không tìm thấy hợp đồng");
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [id, queryRole]);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    let isActive = true;

    const poll = async () => {
      if (!isActive || pollCountRef.current >= MAX_POLLS) return;
      const hasPendingTx = onchainTxs.some(
        (t) => t.status === "PENDING" || t.status === "SUBMITTED",
      );
      const needsPoll =
        hasPendingTx ||
        contract?.status === "PENDING_CONFIRMATION" ||
        contract?.depositStatus === "UNPAID";
      if (!needsPoll) return;

      pollCountRef.current += 1;
      try {
        const data = await apiClient.getContractById(id, queryRole);
        const txs = await apiClient.getOnchainTxs(id);
        if (isActive) {
          setContract(data);
          setOnchainTxs(txs);
        }
      } catch {
        // Passive poll ignore
      }
      if (isActive && pollCountRef.current < MAX_POLLS) {
        timer = setTimeout(poll, 3000);
      }
    };

    timer = setTimeout(poll, 3000);
    return () => {
      isActive = false;
      if (timer) clearTimeout(timer);
    };
  }, [id, queryRole, contract?.status, contract?.depositStatus, onchainTxs]);

  return { contract, onchainTxs, loading, error, loadContract };
}
