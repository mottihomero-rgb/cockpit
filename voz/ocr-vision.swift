// ocr-vision.swift — OCR local para o Cockpit (macOS, framework Vision da Apple)
//
// Compilar:  swiftc -O ocr-vision.swift -o ocr-vision
// Usar:      ./ocr-vision /caminho/da/imagem.png
// Saida:     o texto reconhecido no stdout, uma linha por bloco (UTF-8).
//            Erro vai no stderr e o programa sai com codigo != 0:
//              2 = faltou o caminho   3 = nao consegui abrir a imagem   4 = a leitura falhou
//
// Por que um binario proprio, e nao o `shortcuts` ou o `osascript`: a Vision faz o
// reconhecimento AQUI DENTRO, sem rede, sem conta e sem pacote de idioma para instalar.
// pt-BR e en-US juntos porque codigo e print de tela costumam misturar os dois.
// Compilado UMA vez e comitado (mesmo trato do ditado-vivo): nada de compilar em uso.
import Foundation
import CoreGraphics
import ImageIO
import Vision

func morrer(_ msg: String, _ code: Int32) -> Never {
    if let d = (msg + "\n").data(using: .utf8) { FileHandle.standardError.write(d) }
    exit(code)
}

let args = CommandLine.arguments
guard args.count >= 2, !args[1].isEmpty else { morrer("uso: ocr-vision <imagem>", 2) }
let caminho = args[1]

guard let fonte = CGImageSourceCreateWithURL(URL(fileURLWithPath: caminho) as CFURL, nil),
      CGImageSourceGetCount(fonte) > 0,
      let imagem = CGImageSourceCreateImageAtIndex(fonte, 0, nil) else {
    morrer("nao consegui abrir a imagem", 3)
}

let pedido = VNRecognizeTextRequest()
pedido.recognitionLevel = .accurate
pedido.usesLanguageCorrection = true
pedido.recognitionLanguages = ["pt-BR", "en-US"]

do {
    try VNImageRequestHandler(cgImage: imagem, options: [:]).perform([pedido])
} catch {
    morrer("a leitura falhou: \(error.localizedDescription)", 4)
}

// A Vision ja devolve em ordem de leitura; nao reordenamos, para nao embaralhar texto em
// coluna (print de terminal lado a lado, tabela) que ela ja entregou certo.
var linhas: [String] = []
for obs in (pedido.results ?? []) {
    if let melhor = obs.topCandidates(1).first?.string { linhas.append(melhor) }
}
if !linhas.isEmpty {
    FileHandle.standardOutput.write(Data((linhas.joined(separator: "\n") + "\n").utf8))
}
exit(0)
