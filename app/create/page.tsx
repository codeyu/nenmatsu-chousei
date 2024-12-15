'use client'

import { useState, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form"
import { useForm } from "react-hook-form"
import * as pdfjsLib from 'pdfjs-dist'
import { getDocument, PDFDocumentProxy } from 'pdfjs-dist'
import PDFWorker from 'pdfjs-dist/build/pdf.worker.min.js'

// PDFJSワーカーの設定
pdfjsLib.GlobalWorkerOptions.workerSrc = PDFWorker

interface FormField {
  type: string;
  value: string;
  defaultValue: string;
  id: string;
  rect: number[];
  options?: string[];  // ドロップダウン用の選択肢
  isChecked?: boolean; // チェックボックス用
}

// 添加一个辅助函数来解码 Shift-JIS 字节
const decodeShiftJIS = (bytes: number[]): string => {
  try {
    const uint8Array = new Uint8Array(bytes);
    const decoder = new TextDecoder('shift-jis');
    return decoder.decode(uint8Array);
  } catch (e) {
    console.error('Shift-JIS decode error:', e);
    return '';
  }
};

export default function PDFFieldViewer() {
  const [fields, setFields] = useState<Record<string, FormField>>({})
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const form = useForm({
    defaultValues: Object.entries(fields).reduce((acc, [key, field]) => {
      if (field.type === 'Listbox') {
        acc[key] = field.value || field.defaultValue || ''
      } else if (field.type === 'Checkbox') {
        acc[key] = field.isChecked || false
      } else {
        acc[key] = field.value || ''
      }
      return acc
    }, {} as any)
  })

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.[0]) return
    
    try {
      setIsLoading(true)
      setError(null)
      const file = event.target.files[0]
      
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await getDocument({ data: arrayBuffer }).promise
      setPdfDocument(pdf)

      const page = await pdf.getPage(1)
      const annotations = await page.getAnnotations()
      
      console.log('All annotations:', annotations)
      
      const formFields = annotations
        .filter((annot: any) => annot.fieldType)
        .reduce((acc: { [key: string]: FormField }, field: any) => {
          // 获取复选框的导出值
          let exportValueDecoded = '';
          if (field.fieldType === 'Btn' && field.exportValue) {
            const bytes = Array.from(field.exportValue).map(c => c.charCodeAt(0));
            exportValueDecoded = decodeShiftJIS(bytes);
            console.log('Checkbox export value:', {
              fieldName: field.fieldName,
              originalBytes: bytes,
              decodedValue: exportValueDecoded
            });
          }

          acc[field.fieldName] = {
            type: field.fieldType,
            value: field.fieldValue || '',
            defaultValue: field.defaultValue || '',
            id: field.id,
            rect: field.rect,
            // ドロップダウンの選択肢を取得
            ...(field.fieldType === 'Ch' && {
              options: field.options?.map((opt: any) => opt.displayValue) || []
            }),
            // チェックボックスの状態を取得
            ...(field.fieldType === 'Btn' && {
              isChecked: field.fieldValue === exportValueDecoded || 
                        field.fieldValue === 'Yes' || 
                        field.checkBox?.isChecked || 
                        false,
              exportValue: exportValueDecoded  // 保存解码后的值
            })
          }
          return acc
        }, {})
      console.log(formFields)
      setFields(formFields)
      form.reset(Object.entries(formFields).reduce((acc, [key, field]) => {
        acc[key] = field.value || ''
        return acc
      }, {} as any))

    } catch (err) {
      console.error('PDFの処理中にエラーが発生しました:', err)
      setError(`PDFの処理にエラーが発生しました: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsLoading(false)
    }
  }

  // フィールドタイプに応じたフォームコントロールを返す
  const renderFormControl = (fieldName: string, fieldData: FormField) => {
    switch (fieldData.type) {
      case 'Listbox':
        return (
          <select
            {...form.register(fieldName)}
            className="w-full p-2 border rounded-md"
          >
            <option value="">選択してください</option>
            {fieldData.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        )
      case 'Checkbox':
        return (
          <input
            type="checkbox"
            {...form.register(fieldName)}
            defaultChecked={fieldData.isChecked}
            className="h-4 w-4"
          />
        )
      default:
        return <Input {...form.register(fieldName)} />
    }
  }

  const onSubmit = async (data: any) => {
    if (!pdfDocument) {
      setError('PDFファイルが読み込まれていません')
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // フォームデータの更新
      for (const [fieldName, value] of Object.entries(data)) {
        const field = fields[fieldName]
        if (field) {
          if (field.type === 'Btn') {
            // チェックボックスの場合
            const checkboxValue = value ? (field.exportValue || 'Yes') : 'Off'
            await pdfDocument.annotationStorage.setValue(
              field.id,
              { 
                value: checkboxValue,
                valueAsString: checkboxValue,
                boolean: value === true
              }
            )
          } else {
            // その他のフィールドの場合
            const fieldValue = value || ''
            await pdfDocument.annotationStorage.setValue(
              field.id,
              { 
                value: fieldValue, 
                valueAsString: fieldValue
              }
            )
          }
        }
      }

      // PDFダウンロード
      try {
        const serialized = await pdfDocument.saveDocument()
        const blob = new Blob([serialized], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = '編集済み.pdf'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } catch (saveError) {
        console.error('PDF保存エラー:', saveError)
        setError('PDFの保存に失敗しました。ブラウザの制限により、一部のPDFは保存できない場合があります。')
      }

    } catch (err) {
      console.error('PDFの保存中にエ��ーが発生しました:', err)
      setError(`PDFの保存中にエラーが発生しました: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>PDF フォーム編集</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col space-y-2">
            <Input
              type="file"
              accept=".pdf"
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
          </div>
          
          {error && <p className="text-red-500">{error}</p>}
          
          {Object.keys(fields).length > 0 && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {Object.entries(fields).map(([fieldName, field]: [string, FormField]) => (
                  <FormField
                    key={fieldName}
                    control={form.control}
                    name={fieldName}
                    render={({ field: formField }) => (
                      <FormItem>
                        <FormLabel>{fieldName}</FormLabel>
                        <FormControl>
                          {renderFormControl(fieldName, field)}
                        </FormControl>
                      </FormItem>
                    )}
                  />
                ))}
                <Button 
                  type="submit" 
                  className="mt-4"
                  disabled={isLoading}
                >
                  {isLoading ? '処理中...' : 'PDFを保存してダウンロード'}
                </Button>
              </form>
            </Form>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

