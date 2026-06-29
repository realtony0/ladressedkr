"use client";

import { forwardRef } from "react";

import { formatCurrency } from "@/lib/helpers/format";

interface TicketLine {
  nom: string;
  quantite: number;
  prix_unitaire: number;
  supplement: number;
  note: string | null;
  accompaniment: string | null;
  pizza_size: string | null;
}

export interface CaisseTicketData {
  orderId: string;
  tableNumero: number;
  heure: string;
  total: number;
  lines: TicketLine[];
}

export const CaisseTicket = forwardRef<HTMLDivElement, { ticket: CaisseTicketData | null }>(
  function CaisseTicket({ ticket }, ref) {
    if (!ticket) return <div ref={ref} />;

    const date = new Date(ticket.heure);
    const dateStr = date.toLocaleDateString("fr-FR");
    const timeStr = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

    return (
      <div ref={ref} className="hidden print:block font-mono text-xs text-black bg-white w-[72mm] p-2">
        <p className="text-center font-bold text-sm">L&apos;ADRESSE DAKAR</p>
        <p className="text-center text-[10px]">Rond-point Ngor, Dakar</p>
        <p className="text-center text-[10px]">ladresse.sn@outlook.fr</p>
        <div className="border-t border-dashed border-black my-2" />

        <div className="flex justify-between">
          <span>TABLE : {ticket.tableNumero}</span>
          <span>CMD : {ticket.orderId.slice(0, 8).toUpperCase()}</span>
        </div>
        <div className="flex justify-between">
          <span>{dateStr}</span>
          <span>{timeStr}</span>
        </div>

        <div className="border-t border-dashed border-black my-2" />
        <div className="flex justify-between font-bold">
          <span className="flex-1">DÉSIGNATION</span>
          <span className="w-8 text-right">QTÉ</span>
          <span className="w-20 text-right">MONTANT</span>
        </div>
        <div className="border-t border-black my-1" />

        {ticket.lines.map((line, i) => {
          const lineTotal = (line.prix_unitaire + line.supplement) * line.quantite;
          return (
            <div key={i} className="mb-1">
              <div className="flex justify-between">
                <span className="flex-1 truncate">{line.nom}</span>
                <span className="w-8 text-right">{line.quantite}</span>
                <span className="w-20 text-right">{lineTotal.toLocaleString("fr-FR")}</span>
              </div>
              {line.pizza_size && (
                <p className="pl-2 text-[10px]">Format: {line.pizza_size}</p>
              )}
              {line.accompaniment && line.accompaniment !== "Pas d'accompagnement" && (
                <p className="pl-2 text-[10px]">Accomp: {line.accompaniment}</p>
              )}
              {line.note && (
                <p className="pl-2 text-[10px] italic">Note: {line.note}</p>
              )}
            </div>
          );
        })}

        <div className="border-t border-black my-1" />
        <div className="flex justify-between font-bold text-sm">
          <span>TOTAL</span>
          <span>{formatCurrency(ticket.total)}</span>
        </div>
        <div className="border-t border-dashed border-black my-2" />

        <p className="text-center text-[10px] italic">À saisir dans Restobar ↑</p>
        <p className="text-center text-[10px] mt-3">Merci de votre visite !</p>
      </div>
    );
  },
);
