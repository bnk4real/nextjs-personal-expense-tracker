"use client";

import { useState } from "react";
import { Calendar as ShadcnCalendar } from "@/components/ui/calendar";

export default function Calendar({ onSelect, modifiers }: { onSelect?: (d: Date) => void; modifiers?: { hasExpense?: Date[] } }) {
    const [selected, setSelected] = useState<Date | undefined>();

    const handleSelect = (date: Date | undefined) => {
        setSelected(date);
        if (date) onSelect?.(date);
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
            <ShadcnCalendar
                mode="single"
                selected={selected}
                onSelect={handleSelect}
                modifiers={modifiers}
                captionLayout="dropdown"
                className="w-full"
                // modifiersClassNames={{
                //     hasExpense: "relative after:absolute after:bottom-1 after:left-1/2 after:transform after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:bg-green-500 after:rounded-full after:content-['']",
                // }}
            />
        </div>
    );
}
