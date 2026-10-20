"use client";
import { useEffect } from "react";
import { clearReceiptDrafts } from "@/lib/receipt-draft";
export function ClearDrafts() { useEffect(() => { clearReceiptDrafts(); }, []); return null; }
