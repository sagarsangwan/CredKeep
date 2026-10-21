import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { FileText, X, Plus, CheckCircle2 } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { theme } from './theme';
import { Typography } from './Typography';
import { Card } from './Card';
import { Button } from './Button';

export type DocType = 'aadhaar' | 'promissory_note' | 'property_paper' | 'cheque' | 'photo' | 'other';

export interface AttachmentItem {
  id?: string;
  filePath: string;
  fileType?: string;
  docType: DocType;
  fileName?: string;
  fileSize?: number;
}

export interface AttachmentGridProps {
  attachments: AttachmentItem[];
  onChangeAttachments?: (attachments: AttachmentItem[]) => void;
  readOnly?: boolean;
  minRequired?: number;
  mandatoryDocTypes?: DocType[];
  onPreviewAttachment?: (item: AttachmentItem) => void;
}

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  aadhaar: 'Aadhaar Card',
  promissory_note: 'Promissory Note',
  property_paper: 'Property Papers',
  cheque: 'Security Cheque',
  photo: 'Borrower Photo',
  other: 'Other Document',
};

export const AttachmentGrid: React.FC<AttachmentGridProps> = ({
  attachments,
  onChangeAttachments,
  readOnly = false,
  minRequired = 0,
  mandatoryDocTypes = [],
  onPreviewAttachment,
}) => {
  const [pickerModalVisible, setPickerModalVisible] = useState(false);
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [pendingName, setPendingName] = useState<string>('');
  const [pendingType, setPendingType] = useState<string>('image/jpeg');
  const [selectedDocType, setSelectedDocType] = useState<DocType>('promissory_note');

  const handlePickImage = async (useCamera = false) => {
    try {
      let result;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Camera permission is required to capture documents.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          quality: 0.8,
          allowsEditing: false,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Gallery permission is required to select photos.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          quality: 0.8,
          allowsMultipleSelection: false,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setPendingUri(asset.uri);
        setPendingName(asset.fileName || `document_${Date.now()}.jpg`);
        setPendingType(asset.mimeType || 'image/jpeg');
        setPickerModalVisible(true);
      }
    } catch (e: any) {
      Alert.alert('Picker Error', e.message || 'Failed to select media');
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setPendingUri(asset.uri);
        setPendingName(asset.name || `document_${Date.now()}`);
        setPendingType(asset.mimeType || 'application/pdf');
        setPickerModalVisible(true);
      }
    } catch (e: any) {
      Alert.alert('Picker Error', e.message || 'Failed to select document');
    }
  };

  const handleConfirmAdd = () => {
    if (!pendingUri || !onChangeAttachments) return;
    const newItem: AttachmentItem = {
      filePath: pendingUri,
      fileName: pendingName,
      fileType: pendingType,
      docType: selectedDocType,
    };
    onChangeAttachments([...attachments, newItem]);
    setPendingUri(null);
    setPickerModalVisible(false);
  };

  const handleRemove = (index: number) => {
    if (!onChangeAttachments) return;
    Alert.alert('Remove Document', 'Are you sure you want to remove this attachment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          const next = [...attachments];
          next.splice(index, 1);
          onChangeAttachments(next);
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Grid container */}
      <View style={styles.grid}>
        {attachments.map((item, index) => {
          const isImage = item.fileType?.startsWith('image') || item.filePath.match(/\.(jpg|jpeg|png|webp)$/i);
          return (
            <Card key={item.id || `${item.filePath}_${index}`} style={styles.gridItem}>
              <TouchableOpacity
                onPress={() => onPreviewAttachment && onPreviewAttachment(item)}
                disabled={!onPreviewAttachment}
                style={styles.thumbnailWrapper}
              >
                {isImage ? (
                  <Image source={{ uri: item.filePath }} style={styles.thumbnail} resizeMode="cover" />
                ) : (
                  <View style={styles.filePlaceholder}>
                    <FileText size={36} color={theme.colors.textSecondary} />
                  </View>
                )}
                {!readOnly && onChangeAttachments && (
                  <TouchableOpacity
                    style={styles.deleteBadge}
                    onPress={() => handleRemove(index)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <X size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              <View style={styles.infoWrapper}>
                <View style={styles.docTypeBadge}>
                  <Typography variant="labelSm" color={theme.colors.textPrimary}>
                    {DOC_TYPE_LABELS[item.docType] || item.docType}
                  </Typography>
                </View>
                {item.fileName ? (
                  <Typography variant="bodySm" color={theme.colors.textSecondary} numberOfLines={1} style={{ marginTop: 2 }}>
                    {item.fileName}
                  </Typography>
                ) : null}
              </View>
            </Card>
          );
        })}

        {/* Add Button if not readOnly */}
        {!readOnly && onChangeAttachments && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              Alert.alert('Attach Document', 'Choose source for document', [
                { text: 'Camera', onPress: () => handlePickImage(true) },
                { text: 'Gallery Photo', onPress: () => handlePickImage(false) },
                { text: 'PDF / File', onPress: handlePickDocument },
                { text: 'Cancel', style: 'cancel' },
              ]);
            }}
          >
            <View style={styles.addIconCircle}>
              <Plus size={24} color={theme.colors.actionPrimary} />
            </View>
            <Typography variant="labelMd" color={theme.colors.textPrimary} style={{ marginTop: 6 }}>
              Add Document
            </Typography>
            <Typography variant="bodySm" color={theme.colors.textSecondary}>
              Camera, Photo or PDF
            </Typography>
          </TouchableOpacity>
        )}
      </View>

      {/* Mandatory Check Alert / Warning */}
      {mandatoryDocTypes.length > 0 && !readOnly && (
        <View style={styles.mandatoryHint}>
          <Typography variant="bodySm" color={theme.colors.textSecondary}>
            Mandatory: {mandatoryDocTypes.map((t) => DOC_TYPE_LABELS[t]).join(', ')}
          </Typography>
        </View>
      )}

      {/* Modal to specify Document Type after picking */}
      <Modal
        visible={pickerModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Typography variant="titleMd" color={theme.colors.textPrimary}>
              Select Document Type
            </Typography>
            <Typography variant="bodySm" color={theme.colors.textSecondary} style={{ marginTop: 4 }}>
              Categorize this document for compliance & record-keeping
            </Typography>

            <ScrollView style={{ maxHeight: 280, marginVertical: 12 }}>
              {(Object.keys(DOC_TYPE_LABELS) as DocType[]).map((type) => {
                const isSelected = selectedDocType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeOption, isSelected && styles.typeOptionSelected]}
                    onPress={() => setSelectedDocType(type)}
                  >
                    <Typography
                      variant="bodyMd"
                      color={isSelected ? theme.colors.actionPrimary : theme.colors.textPrimary}
                      style={{ fontWeight: isSelected ? '600' : '400' }}
                    >
                      {DOC_TYPE_LABELS[type]}
                    </Typography>
                    {isSelected && (
                      <CheckCircle2 size={20} color={theme.colors.actionPrimary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="ghost"
                onPress={() => {
                  setPendingUri(null);
                  setPickerModalVisible(false);
                }}
              />
              <Button
                title="Attach Document"
                variant="primary"
                onPress={handleConfirmAdd}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: theme.spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridItem: {
    width: '48%',
    padding: 8,
    borderRadius: theme.borderRadius.md,
  },
  thumbnailWrapper: {
    width: '100%',
    height: 110,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceSoft,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  filePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoWrapper: {
    marginTop: 8,
  },
  docTypeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.surfaceSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.xs,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
  },
  addButton: {
    width: '48%',
    height: 160,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.borderDefault,
    borderStyle: 'dashed',
    backgroundColor: theme.colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
  },
  addIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mandatoryHint: {
    marginTop: 8,
    paddingHorizontal: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    maxHeight: '80%',
  },
  typeOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: 4,
  },
  typeOptionSelected: {
    backgroundColor: theme.colors.surfaceSoft,
    borderColor: theme.colors.borderStrong,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 12,
  },
});
