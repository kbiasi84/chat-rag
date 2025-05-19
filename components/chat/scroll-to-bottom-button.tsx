'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ScrollToBottomButton({
  isAtBottom,
  scrollToBottom,
}: {
  isAtBottom: boolean;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
}) {
  return (
    <AnimatePresence>
      {!isAtBottom && (
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 -top-12 z-10"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.15 }}
        >
          <Button
            variant="secondary"
            size="icon"
            className="shadow-md rounded-full size-10"
            onClick={() => scrollToBottom('smooth')}
            aria-label="Scroll to bottom"
          >
            <ChevronDown className="size-5" />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
