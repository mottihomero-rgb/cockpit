// ditado-vivo.swift — ditado ao vivo para o Cockpit (macOS 26, motor nativo da Apple)
//
// Compilar:  swiftc -O ditado-vivo.swift -o ditado-vivo
// Usar:      ./ditado-vivo pt-BR 1.8 120 12
//              arg1 = idioma  arg2 = seg de silencio p/ parar  arg3 = teto em seg
//              arg4 = carencia: espera ANTES da primeira palavra (o silencio so conta depois dela)
// Parar na mao: escrever "stop" no stdin.
// Saida: uma linha JSON por evento, no stdout:
//   {"type":"status","msg":"ouvindo"}          -> ja pode falar
//   {"type":"partial","text":"..."}            -> texto CINZA (ainda muda)
//   {"type":"final","text":"..."}              -> texto PRETO (fechado)
//   {"type":"error","msg":"..."}
import AVFoundation
import Foundation
import Speech

let T0 = Date()
let lock = NSLock()
func emit(_ o: [String: Any]) {
    var m = o; m["ms"] = Int(Date().timeIntervalSince(T0) * 1000)
    guard let d = try? JSONSerialization.data(withJSONObject: m),
          let s = String(data: d, encoding: .utf8) else { return }
    lock.lock(); print(s); fflush(stdout); lock.unlock()
}

final class Estado: @unchecked Sendable {
    private let lk = NSLock()
    private var ultimaVoz = Date()
    private var parou = false
    private var jaFalou = false
    func ouviVoz() { lk.lock(); ultimaVoz = Date(); jaFalou = true; lk.unlock() }
    var caladoHa: Double { lk.lock(); defer { lk.unlock() }; return Date().timeIntervalSince(ultimaVoz) }
    var parado: Bool { lk.lock(); defer { lk.unlock() }; return parou }
    var comecou: Bool { lk.lock(); defer { lk.unlock() }; return jaFalou }
    func parar() { lk.lock(); parou = true; lk.unlock() }
}

@available(macOS 26.0, *)
func ditar(idioma: String, silencio: Double, teto: Double, carencia: Double) async {
    let est = Estado()

    // stdin: "stop" para na hora (botao do microfone)
    Thread.detachNewThread {
        while let linha = readLine(strippingNewline: true) {
            if linha.trimmingCharacters(in: .whitespaces).lowercased() == "stop" { est.parar(); return }
        }
    }

    let loc = Locale(identifier: idioma)
    let instalados = await SpeechTranscriber.installedLocales.map { $0.identifier(.bcp47) }
    guard instalados.contains(where: { $0.lowercased() == idioma.lowercased() }) else {
        emit(["type": "error", "msg": "idioma nao instalado", "instalados": instalados]); return
    }

    // .progressiveTranscription = o preset que solta texto parcial ENQUANTO fala.
    // (montar as opcoes na mao, sem preset, faz o texto so sair no fim — testado.)
    let escriba = SpeechTranscriber(locale: loc, preset: .progressiveTranscription)
    let motor = SpeechAnalyzer(modules: [escriba],
                               options: .init(priority: .userInitiated, modelRetention: .processLifetime))
    let (fila, envia) = AsyncStream<AnalyzerInput>.makeStream()

    guard let alvo = await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [escriba]) else {
        emit(["type": "error", "msg": "sem formato de audio"]); return
    }
    let engine = AVAudioEngine()
    let entrada = engine.inputNode
    let fmtMic = entrada.outputFormat(forBus: 0)
    guard let conv = AVAudioConverter(from: fmtMic, to: alvo) else {
        emit(["type": "error", "msg": "sem conversor de audio"]); return
    }
    let razao = alvo.sampleRate / fmtMic.sampleRate

    // consumidor dos resultados: Task propria, ligada ANTES do audio comecar
    let leitor = Task {
        do {
            for try await r in escriba.results {
                emit(["type": r.isFinal ? "final" : "partial", "text": String(r.text.characters)])
            }
        } catch { emit(["type": "error", "msg": "\(error)"]) }
    }

    do { try await motor.start(inputSequence: fila) }
    catch { emit(["type": "error", "msg": "start: \(error)"]); return }

    entrada.installTap(onBus: 0, bufferSize: 2048, format: fmtMic) { buf, _ in
        var rms: Float = 0
        if let ch = buf.floatChannelData?[0] {
            let n = Int(buf.frameLength); var s: Float = 0
            for i in 0..<n { s += ch[i] * ch[i] }
            rms = (s / Float(max(n, 1))).squareRoot()
        }
        if rms > 0.010 { est.ouviVoz() }              // limiar de voz; subir se o ambiente for barulhento
        let cap = AVAudioFrameCount(Double(buf.frameLength) * razao + 1024)
        guard let saida = AVAudioPCMBuffer(pcmFormat: alvo, frameCapacity: cap) else { return }
        var err: NSError?; var deu = false
        conv.convert(to: saida, error: &err) { _, st in
            if deu { st.pointee = .noDataNow; return nil }
            deu = true; st.pointee = .haveData; return buf
        }
        if err == nil { envia.yield(AnalyzerInput(buffer: saida)) }
    }

    engine.prepare()
    do { try engine.start() } catch { emit(["type": "error", "msg": "microfone: \(error)"]); return }
    emit(["type": "status", "msg": "ouvindo"])

    /* O corte por silencio so vale DEPOIS que ele falou a primeira vez. Sem isto, quem aperta o
       microfone e leva tres segundos para comecar a falar via o ditado morrer sozinho antes de
       dizer a primeira palavra — foi o que aconteceu no primeiro teste. Antes da primeira voz
       vale a carencia: espera longa, e so entao desiste. */
    while !est.parado {
        try? await Task.sleep(nanoseconds: 150_000_000)
        if est.comecou {
            if est.caladoHa > silencio { emit(["type": "status", "msg": "silencio"]); break }
        } else if Date().timeIntervalSince(T0) > carencia {
            emit(["type": "status", "msg": "nao ouvi nada"]); break
        }
        if Date().timeIntervalSince(T0) > teto { emit(["type": "status", "msg": "teto de tempo"]); break }
    }

    entrada.removeTap(onBus: 0)
    engine.stop()
    envia.finish()

    // Fechar o motor TRAVA quando nao houve fala nenhuma (testado: fica preso pra sempre).
    // Nao da para esperar por ele: espera no maximo 2s e sai na marra.
    let pronto = Estado()
    let fecho = Task {
        try? await motor.finalizeAndFinishThroughEndOfInput()
        _ = await leitor.result
        pronto.parar()
    }
    var esperei = 0.0
    while !pronto.parado && esperei < 2.0 {
        try? await Task.sleep(nanoseconds: 100_000_000); esperei += 0.1
    }
    fecho.cancel(); leitor.cancel()
    emit(["type": "status", "msg": "fim"])
    exit(0)   // mata inclusive o fecho travado
}

@available(macOS 26.0, *)
func inicio() async {
    let a = CommandLine.arguments
    let idioma = a.count > 1 ? a[1] : "pt-BR"
    let silencio = a.count > 2 ? (Double(a[2]) ?? 1.8) : 1.8
    let teto = a.count > 3 ? (Double(a[3]) ?? 120) : 120
    let carencia = a.count > 4 ? (Double(a[4]) ?? 12) : 12
    let ok = await withCheckedContinuation { (c: CheckedContinuation<Bool, Never>) in
        AVCaptureDevice.requestAccess(for: .audio) { c.resume(returning: $0) }
    }
    guard ok else {
        emit(["type": "error", "msg": "sem permissao de microfone"]); return
    }
    await ditar(idioma: idioma, silencio: silencio, teto: teto, carencia: carencia)
}

if #available(macOS 26.0, *) { await inicio() }
else { emit(["type": "error", "msg": "precisa de macOS 26 ou mais novo"]) }
