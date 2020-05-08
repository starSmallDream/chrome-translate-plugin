console.log("谷歌翻译",window.document,document.body)




function translateDom(){
    let selection = window.getSelection();

    if(selection.isCollapsed || selection.rangeCount === 0){
        throw new Error("请选择文本再进行翻译");
    }

    let [host,pathname] = [window.location.host,window.location.pathname]

    let excludes = DOMUtils.getExclude(host)

    let elements = DOMUtils.extractTranslateDomsBySelection(null,selection,excludes)
    console.log("第一步,所检索出的元素DOM对象",elements)

    let allRanges = []
    elements.forEach(function(dom){
        let ranges =  DOMUtils.extractRangesByDom(dom,selection);
        allRanges.push(...ranges.array)
    })
    top.elements = elements
    top.allRanges = allRanges
    console.log("第二部,分析出的所有需要翻译的Ranges",allRanges)

}


class DOMUtils{
    static excludes = {
        //一个域名下有多个匹配规则
        "域名":[
            {
                path:"子路径(匹配形式)",//前端给的路径匹配正则，应用排除元素选择器规则，决定是否应用这个排除规则,正则表达式
                //带css选择器的排除规则，只能排除DOM，这个是根据DOM对象进行排除的
                excludeElementSelector:"span>a,em strong",
                //单个元素的排除规则，这个是根据标签名进行排除的
                excludeElementSelectors:["span","a","em","strong"]
            }
        ]
    };

    static find(key,path){
        let excludeRules = this.excludes[key]
        if(!excludeRules){
            excludeRules = []
        }
        let regExp,result = []
        excludeRules.forEach(function(exclude){
            if(exclude.path === null || exclude.path.trim() === ""){
                result.push(exclude)
            }else{
                regExp = new RegExp(exclude.path)
                if(regExp.test(path)){
                    result.push(exclude)
                }
            }
        })
    }
    /**
     * 设置排除元素规则
     * @parm key 域名
     * @param exclude
     */
    static setExclude(key,...exclude){
        this.excludes[key] = exclude
    }
    static addExclude(key,...exclude){
        this.excludes[key].push(...exclude)
    }

    /**
     * 根据域名提取排除规则对象
     * @param host 域名
     */
    static getExclude(host){
        let exclude = this.excludes[host];
        if(!exclude){
            console.info("%s 未包含在排除规则中",host)
            //保持兼容，返回空对象
            return [
                {
                    path:"",
                    excludeElementSelector:"",
                    excludeElementSelectors:[]
                }
            ]
        }
        return JSON.parse(JSON.stringify(exclude))
    }

    static extractRanges(ranges,node,startOffset){
        let that = this,nodeValue = node.nodeValue,textRange=ranges.processing.o
        startOffset = startOffset || 0
        let r = that.matchPoint(nodeValue,startOffset)
        let result = r.result
        while(true) {
            if(result === null) break
            //offset基于1开始
            textRange.setEnd(node, r.re.lastIndex)
            ranges.processing.toEnd = false
            ranges.processing.isComplete = true
            ranges.array.push(ranges.processing)
            //设置新Range对象
            startOffset = r.re.lastIndex
            textRange = new Range()
            //offset基于0开始
            textRange.setStart(node,startOffset)
            ranges.processing = {o:textRange,isComplete:false,toStart:false,toEnd:true}

            result = r.re.exec(nodeValue)
        }
    }

    /**
     *
     * @param ranges
     * @param node
     * @param range 当range为undefined或为null，将以 node 对象创建一个新的Range对象
     */
    static extractAfterEndNode(ranges,node,range){
        let textRange = ranges.processing.o
        if(range === undefined || range === null){
            //结束中间节点的的End结束
            range = new Range()
            range.selectNodeContents(node)
        }
        if(!ranges.processing.isComplete && ranges.processing.toEnd){
            let endOffset = range.endOffset
            textRange.setEnd(node,endOffset)
            ranges.processing.toEnd = false
            ranges.processing.isComplete = true
            ranges.array.push(ranges.processing)
            ranges.processing = null
        }
    }

    /**
     * 提取指定dom里的以句号分隔的Ranges对象集合
     * @param dom 针对的根DOM元素
     * @param selection 选区的对象getSelection()
     * @param ranges 数组Ranges集合,结果集合
     */
    static extractRangesByDom(dom,selection,ranges,deep) {
        let that = this,constituency = selection
        // constituency选区的对象 ==> {selection:{},ranges:[range]}
        // Range==>{range:对象,isComplete:false,toStart:false,toEnd:true}
        //递归层级，从1开始
        if(deep === undefined || deep === null){
            deep = 1
        }else{
            deep++
        }

        if(selection instanceof Selection){
            constituency = {
                selection: selection,
                firstRange: selection.getRangeAt(0)
            }
        }
        let range = constituency.firstRange

        ranges = ranges || []
        if(ranges.array === undefined){
            ranges.array = []
        }
        if(ranges.processing === undefined){
            ranges.processing = null
        }
        //正文开始
        let childNodes
        if(dom.nodeType === Node.TEXT_NODE){
            childNodes = [dom]
        }else{
            childNodes = dom.childNodes
        }

        childNodes.forEach(function(node,index,nodes){
            let nodeType = node.nodeType
            if(Node.ELEMENT_NODE === nodeType){
                that.extractRangesByDom(node,constituency,ranges,deep)
            }else if(Node.TEXT_NODE === nodeType){
                if(range.startContainer === range.endContainer){
                    let startOffset = range.startOffset
                    let textRange = new Range()
                    textRange.setStart(node,startOffset)
                    ranges.processing = {o:textRange,isComplete:false,toStart:false,toEnd:true}
                    that.extractRanges(ranges,node,startOffset)
                    //结束最后的一个节点对象Range的End结束
                    that.extractAfterEndNode(ranges,node,range)
                }else {
                    if(node === range.startContainer){
                        let startOffset = range.startOffset
                        let textRange = new Range()
                        textRange.setStart(node,startOffset)
                        ranges.processing = {o:textRange,isComplete:false,toStart:false,toEnd:true}
                        that.extractRanges(ranges,node,startOffset)
                    }else if(node === range.endContainer){
                        that.extractRanges(ranges,node)
                        //结束最后的一个节点对象Range的End结束
                        that.extractAfterEndNode(ranges,node,range)
                    }else{
                        if(ranges.processing === null){
                            let textRange = new Range()
                            textRange.setStart(node,0)
                            ranges.processing = {o:textRange,isComplete:false,toStart:false,toEnd:true}
                        }
                        that.extractRanges(ranges,node)
                    }
                    if(deep ===1 && index === nodes.length-1 && ranges.processing!==null && !ranges.processing.isComplete){
                        let middleRange = (node === range.startContainer || node !== range.endContainer) ? null:range
                        //结束最后的一个节点对象Range的End结束
                        that.extractAfterEndNode(ranges,node,middleRange)
                    }
                }
            }
        })

        return ranges
    }



    static matchPoint(text,startIndex){
        const regex = new RegExp(/\.\s/,"g")
        regex.lastIndex = startIndex || 0
        return {result:regex.exec(text),re:regex}
    }


    static getOwnElement(dom){
        if(Node.ELEMENT_NODE === dom.nodeType){
            return dom
        }
        let parentElement = dom.parentElement
        return this.getOwnElement(parentElement)
    }

    /**
     * 捕获方式进行遍历出选区的DOM对象
     * @param dom
     * @param selection
     * @param exclude
     * @param elements
     * @returns {*}
     */
    static extractTranslateDomsBySelection(dom,selection,excludes,elements){
        //返回的结果元素数组
        elements = elements || []

        let range = selection.getRangeAt(0)
        if(dom === null){
            dom = range.commonAncestorContainer
        }

        if(dom === this.getOwnElement(range.startContainer) || dom === this.getOwnElement(range.endContainer)){
            elements.push(dom)
        }else{
            if(selection.containsNode(dom)){
                //完全包含节点
                elements.push(dom)
            }else{
                let children = dom.children
                if(children.length>0){
                    for(let i=0;i<children.length;i++){
                        let dom = children.item(i)
                        let nodeName = dom.nodeName
                        if(dom.nodeType === Node.ELEMENT_NODE && this.excludeRuleMatchers(excludes,function(exclude){
                            exclude.excludeElementSelectors.includes(nodeName.toLowerCase())
                        })){
                            continue
                        }

                        //当此节点被部分包含选中的范围
                        if(selection.containsNode(dom,true)){
                            this.extractTranslateDomsBySelection(dom,selection,excludes,elements)
                        }
                    }
                }
            }
        }
        return elements
    }

    static excludeRuleMatchers(excludes,callback){
        excludes = excludes || []
        return excludes.some(function(exclude){
            callback(exclude)
        })
    }

}
