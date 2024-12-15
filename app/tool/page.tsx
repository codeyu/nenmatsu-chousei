'use client'
import { useState, useEffect } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Copy, ExternalLink, FileText, Check } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function YearEndTaxAdjustment() {
  const [income, setIncome] = useState<string>('')
  const [taxableIncome, setTaxableIncome] = useState<number | null>(null)
  const [highlightedRow, setHighlightedRow] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copySuccess, setCopySuccess] = useState<string | null>(null)

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [error])

  const calculateTaxableIncome = (income: number): [number, number] => {
    if (income <= 550999) return [0, 0]
    if (income <= 1618999) return [income - 550000, 1]
    if (income <= 1619999) return [1069000, 2]
    if (income <= 1621999) return [1070000, 3]
    if (income <= 1623999) return [1072000, 4]
    if (income <= 1627999) return [1074000, 5]
    if (income <= 1799999) return [Math.floor(income / 4) * 2.4 - 100000, 6]
    if (income <= 3599999) return [Math.floor(income / 4) * 2.8 - 80000, 7]
    if (income <= 6599999) return [Math.floor(income / 4) * 3.2 - 440000, 8]
    if (income <= 8499999) return [Math.floor(income * 0.9) - 1100000, 9]
    return [income - 1950000, 10]
  }

  const handleCalculate = () => {
    const incomeValue = parseInt(income.replace(/,/g, ''), 10)
    if (isNaN(incomeValue)) {
      setError("正しい数値を入力してください。")
      return
    }
    const [calculatedIncome, rowNumber] = calculateTaxableIncome(incomeValue)
    setTaxableIncome(calculatedIncome)
    setHighlightedRow(rowNumber)
  }

  const handleClear = () => {
    setIncome('')
    setTaxableIncome(null)
    setHighlightedRow(null)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(text)
      setTimeout(() => {
        setCopySuccess(null)
      }, 2000)
    }).catch(err => {
      console.error('コピーに失敗しました', err)
      setError("コピーに失敗しました。")
    })
  }

  return (
    <div className="container mx-auto p-4">
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>エラー</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>年末調整 給与所得金額計算ツール</CardTitle>
          <CardDescription>給与の収入金額に対する所得金額を計算します。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <Input
              type="text"
              placeholder="給与の収入金額"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
              className="text-right"
            />
            <span>円</span>
            {income && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => copyToClipboard(income)}
                aria-label="給与金額をコピー"
              >
                {copySuccess === income ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
          <div className="flex space-x-2 mb-4">
            <Button onClick={handleCalculate}>計算</Button>
            <Button variant="outline" onClick={handleClear}>クリア</Button>
          </div>
          <div className="text-center mb-4">
            <p className="text-lg font-bold">所得金額</p>
            <div className="flex items-center justify-center">
              <p className="text-3xl font-bold min-h-[48px]">
                {taxableIncome !== null ? `${taxableIncome.toLocaleString()}円` : '　'}
              </p>
              {taxableIncome !== null && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => copyToClipboard(taxableIncome.toString())}
                  aria-label="所得金額をコピー"
                >
                  {copySuccess === taxableIncome.toString() ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
          <TaxTable highlightedRow={highlightedRow} />
          <div className="mt-4 text-sm text-gray-600">
            <p>計算方法の詳細については、以下のリンクをご参照ください：</p>
            <a
              href="https://www.nta.go.jp/users/gensen/nencho/shinkokusyo/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline flex items-center"
            >
              各種申告書・記載例（扶養控除等申告書など）
              <ExternalLink className="h-4 w-4 ml-1" />
            </a>
            <a
              href="https://www.nta.go.jp/taxes/tetsuzuki/shinsei/annai/gensen/pdf/2024bun_07.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline flex items-center mt-2"
            >
              <FileText className="h-4 w-4 mr-1" />
              <span className="text-xs">
                pdf文書：《記載例》令和６年分基礎控除申告書兼配偶者控除等申告書兼年末調整に係る定額減税のための申告書兼所得金額調整控除申告書
              </span>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function TaxTable({ highlightedRow }: { highlightedRow: number | null }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-1/2">給与の収入金額（A）</TableHead>
          <TableHead>所得金額</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[
          ["1円 ～ 550,999円", "0円"],
          ["551,000円 ～ 1,618,999円", "A - 550,000円"],
          ["1,619,000円 ～ 1,619,999円", "1,069,000円"],
          ["1,620,000円 ～ 1,621,999円", "1,070,000円"],
          ["1,622,000円 ～ 1,623,999円", "1,072,000円"],
          ["1,624,000円 ～ 1,627,999円", "1,074,000円"],
          ["1,628,000円 ～ 1,799,999円", "A ÷ 4 × 2.4 - 100,000円"],
          ["1,800,000円 ～ 3,599,999円", "A ÷ 4 × 2.8 - 80,000円"],
          ["3,600,000円 ～ 6,599,999円", "A ÷ 4 × 3.2 - 440,000円"],
          ["6,600,000円 ～ 8,499,999円", "A × 0.9 - 1,100,000円"],
          ["8,500,000円 ～", "A - 1,950,000円"],
        ].map((row, index) => (
          <TableRow key={index} className={highlightedRow === index ? "bg-yellow-100" : ""}>
            <TableCell>{row[0]}</TableCell>
            <TableCell>{row[1]}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}