'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calculator } from 'lucide-react';

interface CalculatorDialogProps {
    trigger?: React.ReactNode;
}

export default function CalculatorDialog({ trigger }: CalculatorDialogProps) {
    const [display, setDisplay] = useState('0');
    const [previousValue, setPreviousValue] = useState<number | null>(null);
    const [operation, setOperation] = useState<string | null>(null);
    const [waitingForOperand, setWaitingForOperand] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    // Calculator functions
    const calculate = (firstValue: number, secondValue: number, operation: string) => {
        switch (operation) {
            case '+':
                return firstValue + secondValue;
            case '-':
                return firstValue - secondValue;
            case '*':
                return firstValue * secondValue;
            case '/':
                return firstValue / secondValue;
            case '=':
                return secondValue;
            default:
                return secondValue;
        }
    };

    const inputNumber = useCallback((num: string) => {
        if (waitingForOperand) {
            setDisplay(num);
            setWaitingForOperand(false);
        } else {
            setDisplay(display === '0' ? num : display + num);
        }
    }, [display, waitingForOperand]);

    const inputOperation = useCallback((nextOperation: string) => {
        const inputValue = parseFloat(display);

        if (previousValue === null) {
            setPreviousValue(inputValue);
        } else if (operation) {
            const currentValue = previousValue || 0;
            const newValue = calculate(currentValue, inputValue, operation);

            setDisplay(`${parseFloat(newValue.toFixed(7))}`);
            setPreviousValue(newValue);
        }

        setWaitingForOperand(true);
        setOperation(nextOperation);
    }, [display, previousValue, operation]);

    const performCalculation = useCallback(() => {
        const inputValue = parseFloat(display);

        if (previousValue !== null && operation) {
            const newValue = calculate(previousValue, inputValue, operation);
            setDisplay(`${parseFloat(newValue.toFixed(7))}`);
            setPreviousValue(null);
            setOperation(null);
            setWaitingForOperand(true);
        }
    }, [display, previousValue, operation]);

    const clear = useCallback(() => {
        setDisplay('0');
        setPreviousValue(null);
        setOperation(null);
        setWaitingForOperand(false);
    }, []);

    const inputDecimal = useCallback(() => {
        if (waitingForOperand) {
            setDisplay('0.');
            setWaitingForOperand(false);
        } else if (display.indexOf('.') === -1) {
            setDisplay(display + '.');
        }
    }, [display, waitingForOperand]);

    // Keyboard event handler
    const handleKeyPress = useCallback((event: KeyboardEvent) => {
        if (!isOpen) return;

        const key = event.key;

        // Prevent default behavior for calculator keys
        if (['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '+', '-', '*', '/', '=', 'Enter', 'Escape', 'Backspace'].includes(key)) {
            event.preventDefault();
        }

        if (key >= '0' && key <= '9') {
            inputNumber(key);
        } else if (key === '.') {
            inputDecimal();
        } else if (key === '+') {
            inputOperation('+');
        } else if (key === '-') {
            inputOperation('-');
        } else if (key === '*') {
            inputOperation('*');
        } else if (key === '/') {
            inputOperation('/');
        } else if (key === '=' || key === 'Enter') {
            performCalculation();
        } else if (key === 'Escape' || key === 'c' || key === 'C') {
            clear();
        } else if (key === 'Backspace') {
            // Handle backspace to delete last character
            if (display.length > 1) {
                setDisplay(display.slice(0, -1));
            } else {
                setDisplay('0');
            }
        }
    }, [isOpen, inputNumber, inputDecimal, inputOperation, performCalculation, clear, display]);

    // Add keyboard event listeners when dialog is open
    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleKeyPress);
            return () => {
                document.removeEventListener('keydown', handleKeyPress);
            };
        }
    }, [isOpen, handleKeyPress]);

    // Reset calculator when dialog closes
    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (!open) {
            clear();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Calculator className="w-4 h-4" />
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-75">
                <DialogHeader>
                    <DialogTitle>Calculator</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    {/* Display */}
                    <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-right text-lg font-mono">
                        {display}
                    </div>

                    {/* Calculator Buttons */}
                    <div className="grid grid-cols-4 gap-2">
                        {/* Row 1 */}
                        <Button variant="outline" onClick={clear} className="col-span-2">
                            Clear
                        </Button>
                        <Button variant="outline" onClick={() => inputOperation('/')}>
                            ÷
                        </Button>
                        <Button variant="outline" onClick={() => inputOperation('*')}>
                            ×
                        </Button>

                        {/* Row 2 */}
                        <Button variant="outline" onClick={() => inputNumber('7')}>
                            7
                        </Button>
                        <Button variant="outline" onClick={() => inputNumber('8')}>
                            8
                        </Button>
                        <Button variant="outline" onClick={() => inputNumber('9')}>
                            9
                        </Button>
                        <Button variant="outline" onClick={() => inputOperation('-')}>
                            −
                        </Button>

                        {/* Row 3 */}
                        <Button variant="outline" onClick={() => inputNumber('4')}>
                            4
                        </Button>
                        <Button variant="outline" onClick={() => inputNumber('5')}>
                            5
                        </Button>
                        <Button variant="outline" onClick={() => inputNumber('6')}>
                            6
                        </Button>
                        <Button variant="outline" onClick={() => inputOperation('+')}>
                            +
                        </Button>

                        {/* Row 4 */}
                        <Button variant="outline" onClick={() => inputNumber('1')}>
                            1
                        </Button>
                        <Button variant="outline" onClick={() => inputNumber('2')}>
                            2
                        </Button>
                        <Button variant="outline" onClick={() => inputNumber('3')}>
                            3
                        </Button>
                        <Button variant="outline" onClick={performCalculation} className="row-span-2">
                            =
                        </Button>

                        {/* Row 5 */}
                        <Button variant="outline" onClick={() => inputNumber('0')} className="col-span-2">
                            0
                        </Button>
                        <Button variant="outline" onClick={inputDecimal}>
                            .
                        </Button>
                    </div>

                    {/* Keyboard shortcuts hint */}
                    <div className="text-xs text-muted-foreground text-center">
                        Use keyboard: numbers, +, -, *, /, =, Enter, Escape (clear), Backspace
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}