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
      const pdf = await getDocument({
        data: arrayBuffer,
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
        cMapPacked: true,
        standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/'
      }).promise
      setPdfDocument(pdf)

      // 获取所有页面的内容
      const pdfContent: any = {
        pageCount: pdf.numPages,
        pages: []
      }

      // 遍历所有页面
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const pageContent: any = {
          pageNumber: i,
          annotations: [],
          textContent: null,
          images: []  // 添加图片数组
        }

        // 获取页面操作列表
        const opList = await page.getOperatorList()
        console.log('Page operator list:', opList)

        // 获取注释（表单字段等）
        const annotations = await page.getAnnotations()
        pageContent.annotations = annotations.map((annot: any) => {
          console.log('Annotation details:', {
            type: annot.subtype,
            fieldType: annot.fieldType,
            fieldName: annot.fieldName,
            fieldValue: annot.fieldValue,
            buttonValue: annot.buttonValue,
            checkBox: annot.checkBox,
            state: annot.state,
            stateModel: annot.stateModel,
            // 添加这些新的检查项
            as: annot.as,
            mk: annot.mk,
            appearanceState: annot.appearanceState,
            appearance: annot.appearance,
            appearanceStreamContent: annot.appearanceStreamContent,
            // 尝试获取图像数据
            normalAppearance: annot.appearance?.normal,
            checkedAppearance: annot.appearance?.on,
            uncheckedAppearance: annot.appearance?.off,
            // AP (Appearance) 字典
            AP: annot.AP,
            // 其他可能包含外观信息的属性
            MK: annot.MK,
            DA: annot.DA,
            raw: annot
          });

          return {
            type: annot.subtype,
            fieldType: annot.fieldType,
            fieldName: annot.fieldName,
            id: annot.id,
            rect: annot.rect,
            value: annot.fieldValue,
            defaultValue: annot.defaultValue,
            options: annot.options,
            ...(annot.fieldType === 'Btn' && {
              buttonValue: annot.buttonValue,
              checkBox: annot.checkBox,
              state: annot.state,
              stateModel: annot.stateModel,
              appearanceState: annot.appearanceState,
              // 检查多个可能的状态标识
              isChecked: 
                annot.fieldValue === 'Yes' ||
                annot.state === 'Yes' ||
                annot.appearanceState === 'Yes' ||
                (annot.as && annot.as.name === 'Yes') ||
                annot.checkBox?.isChecked ||
                false
            })
          }
        })

        // 获取文本内容
        const textContent = await page.getTextContent()
        console.log('Raw text content:', textContent) // 打印原始文本内容

        pageContent.textContent = {
          // 按项目分类的文本
          items: textContent.items.map((item: any) => ({
            text: item.str,
            x: item.transform[4],
            y: item.transform[5],
            fontSize: item.transform[0],
            fontName: item.fontName,
            // 添加更多调试信息
            transform: item.transform,
            width: item.width,
            height: item.height,
            type: item.type
          })),
          // 合并所有文本
          fullText: textContent.items
            .map((item: any) => item.str)
            .join(' '),
          // 添加原始数据用于调试
          raw: textContent
        }

        pdfContent.pages.push(pageContent)
      }

      // 打印完整的PDF内容
      console.log('PDF Content:', JSON.stringify(pdfContent, null, 2))

      // 继续处理表单字段
      const annotations = await pdf.getPage(1).then(page => page.getAnnotations())
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

          // 查复选框状态
          const getCheckboxState = (annot: any) => {
            // 检查外观状态
            const hasCheckedAppearance = annot.appearance?.normal?.has('Yes') || 
                                        annot.AP?.N?.has('Yes');
            
            return {
              isChecked: 
                annot.fieldValue === 'Yes' ||
                annot.state === 'Yes' ||
                annot.appearanceState === 'Yes' ||
                (annot.as && annot.as.name === 'Yes') ||
                annot.checkBox?.isChecked ||
                false,
              // 保存外观相关信息
              appearance: {
                normal: annot.appearance?.normal,
                checked: annot.appearance?.on || annot.AP?.N?.get('Yes'),
                unchecked: annot.appearance?.off || annot.AP?.N?.get('Off'),
                current: annot.appearance?.normal?.get(annot.appearanceState || 'Off')
              }
            };
          };

          const checkboxState = getCheckboxState(field);
          console.log('Checkbox appearance:', {
            fieldName: field.fieldName,
            ...checkboxState
          });

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
              isChecked: checkboxState.isChecked,
              appearance: checkboxState.appearance
            })
          }
          
          // 添加调试日志
          if (field.fieldType === 'Btn') {
            console.log('Checkbox field details:', {
              fieldName: field.fieldName,
              isChecked: checkboxState.isChecked,
              fieldValue: field.fieldValue,
              state: field.state,
              appearanceState: field.appearanceState,
              as: field.as,
              checkBox: field.checkBox
            });
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
      setError(`PDFの処理中にエラーが発生しました: ${err instanceof Error ? err.message : String(err)}`)
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

      // フォーデータの更新
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
      console.error('PDFの保存中にエラーが発生しました:', err)
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

