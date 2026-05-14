      <div className="border-t px-4 py-3 bg-card/80 backdrop-blur-md">
        {isMember ? (
          <>
            {/* Recording indicator */}
            {isRecording && (
              <div className="mb-2 flex items-center justify-between rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-2.5">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                  <span className="text-xs font-semibold text-red-600 dark:text-red-400">Gravando {formatRecDuration(recordingSeconds)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={cancelRecording} className="flex h-7 w-7 items-center justify-center rounded-full bg-muted hover:bg-destructive hover:text-destructive-foreground transition-colors" title="Cancelar">
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={stopRecording} className="flex h-7 items-center gap-1 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground" title="Enviar">
                    <Send className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              {/* Camera */}
              <button
                onClick={() => cameraRef.current?.click()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-primary transition-colors"
                title="Tirar foto"
              >
                <Camera className="h-4 w-4" />
              </button>
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={(e) => { const f = e.target.files?.[0]; if (f) { sendMessage("📷 Foto enviada"); if (cameraRef.current) cameraRef.current.value = ""; } }} className="hidden" />

              {/* Gallery */}
              <button
                onClick={() => galleryRef.current?.click()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-primary transition-colors"
                title="Foto da galeria"
              >
                <ImagePlus className="h-4 w-4" />
              </button>
              <input ref={galleryRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) { sendMessage("📷 Foto enviada"); if (galleryRef.current) galleryRef.current.value = ""; } }} className="hidden" />

              {/* Input */}
              <div className="flex-1 relative">
                <Input
                  placeholder="Escreva uma mensagem..."
                  value={input}
                  onChange={(e) => setInput(e.target.value.slice(0, 2000))}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  className="h-11 rounded-full pl-4 pr-4 bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/30"
                />
              </div>

              {/* Mic */}
              <button
                onClick={() => { if (!isRecording) startRecording(); }}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${isRecording ? "text-red-500 bg-red-500/10" : "text-muted-foreground hover:bg-accent hover:text-primary"}`}
                title="Gravar áudio"
              >
                {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>

              {/* Send */}
              <Button
                size="icon"
                onClick={sendMessage}
                disabled={!input.trim() || isRecording}
                className="h-11 w-11 rounded-full shrink-0 shadow-sm transition-all hover:shadow-md disabled:shadow-none"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <Button onClick={handleJoin} className="w-full h-11 rounded-full gap-2 shadow-sm">
            <UserCheck className="h-4 w-4" /> Entrar na sala
          </Button>
        )}
      </div>
