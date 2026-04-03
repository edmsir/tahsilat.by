import { motion, AnimatePresence } from 'framer-motion';
import RecordForm from './RecordForm';
import type { Kayit } from '../../types';

interface EditRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: Kayit | null;
  onSuccess: () => void;
  isRequest?: boolean;
}

export default function EditRecordModal({ isOpen, onClose, record, onSuccess, isRequest }: EditRecordModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100]"
          />
          
          {/* Modal Container */}
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[101] pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-4xl bg-card border border-border shadow-2xl rounded-2xl p-6 pointer-events-auto"
            >
              <RecordForm 
                initialData={record} 
                isRequest={isRequest}
                onSuccess={() => {
                  onSuccess();
                  setTimeout(onClose, 1000);
                }} 
                onCancel={onClose}
              />
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
