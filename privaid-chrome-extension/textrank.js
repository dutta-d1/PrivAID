class TextRank {
    constructor(text, windowSize = 2, iterations = 30, damping = 0.85) {
        this.text = text;
        this.windowSize = windowSize;
        this.iterations = iterations;
        this.damping = damping;
        this.sentences = this.splitIntoSentences(text);
        this.graph = this.buildGraph();
    }

    splitIntoSentences(text) {
        return text.match(/[^\.!\?]+[\.!\?]+/g) || [];
    }

    buildGraph() {
        const graph = {};
        for (let i = 0; i < this.sentences.length; i++) {
            graph[i] = {};
            for (let j = 0; j < this.sentences.length; j++) {
                if (i !== j) {
                    graph[i][j] = this.calculateSimilarity(this.sentences[i], this.sentences[j]);
                }
            }
        }
        return graph;
    }

    calculateSimilarity(sent1, sent2) {
        const words1 = sent1.toLowerCase().split(/\s+/);
        const words2 = sent2.toLowerCase().split(/\s+/);
        const commonWords = words1.filter(word => words2.includes(word));
        return commonWords.length / (Math.log(words1.length) + Math.log(words2.length));
    }

    runTextRank() {
        let scores = {};
        for (let i = 0; i < this.sentences.length; i++) {
            scores[i] = 1;
        }

        for (let iter = 0; iter < this.iterations; iter++) {
            const newScores = {};
            for (let i in this.graph) {
                let sum = 0;
                for (let j in this.graph[i]) {
                    sum += this.graph[i][j] * scores[j] / Object.keys(this.graph[j]).length;
                }
                newScores[i] = (1 - this.damping) + this.damping * sum;
            }
            scores = newScores;
        }

        return scores;
    }

    summarize(numSentences = 3) {
        const scores = this.runTextRank();
        const sortedSentences = Object.keys(scores)
            .sort((a, b) => scores[b] - scores[a])
            .slice(0, numSentences);

        return sortedSentences
            .sort((a, b) => parseInt(a) - parseInt(b))
            .map(i => this.sentences[i])
            .join(' ');
    }
}

// Function to be called from other scripts
function summarizeTextRank(text, numSentences = 3) {
    if (text.split(' ').length < 100) {
        return text; // Return the original text if it's too short
    }
    
    const textRank = new TextRank(text);
    return textRank.summarize(numSentences);
}