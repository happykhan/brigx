<script>
  import { interpolate } from 'd3';
    import { arc, symbol, symbolTriangle } from 'd3-shape';
    // Figure settings 
    let height = 800;
    let width = 600;    
    let total = 72000;
    let arrowAngleLimit = 5; 
    let bevelPercentage = 20;

    // Ring settings
    let featureThickness = 20;
    let offset = 80;
    let row = 1;     

    // Demo data
    let demo = [
    {
        "start": 100,
        "stop": 1230, 
        "label": "geneA",
        "color": "#DF573A",
        "reverse": true
    },
    {
        "start": 3300,
        "stop": 4330, 
        "label": "geneB",
        "color": "#75D086",
        "reverse": false
    },    
    {
        "start": 20000,
        "stop": 29000, 
        "label": "geneB",
        "color": "#C275D0",
        "reverse": true
    },        
    {
        "start": 40900,
        "stop": 55000, 
        "label": "geneB",
        "color": "#1E1C84",
        "reverse": false
    },            
    ]
    // Swap start and stop if stop is less than start.
    demo.forEach((feature) => {
        if (feature.stop < feature.start) {
            let temp = feature.start 
            feature.start = feature.stop 
            feature.stop = temp 
        }
    })
    // Need to sort so largest elements are drawn first, and smaller elements are drawn on top.
    
    demo.sort(compareData);
    
    function compareData(a,b){
        let aLen = a.stop - a.start
        let bLen = b.stop - b.start
        if (aLen > bLen) {
            return -1
        } else if (aLen < bLen) {
            return 1
        } else {
            return 0
        }
    }
    function shiftColor(color, percent=20, darken=false) {
        var num = parseInt(color.replace("#",""),16); 
        let amt = Math.round(2.55 * percent);
        if (darken) {
            amt = amt * -1 
        }
        let R = (num >> 16) + amt;
        let B = (num >> 8 & 0x00FF) + amt;
        let G = (num & 0x0000FF) + amt;
        return "#" + (0x1000000 + (R<255?R<1?0:R:255)*0x10000 + (B<255?B<1?0:B:255)*0x100 + (G<255?G<1?0:G:255)).toString(16).slice(1);
    };

    function arrowPoint(r, arrowStartAngle, arrowEndAngle) {
        let startAngle_rad = (arrowStartAngle - 90 ) * Math.PI / 180 
        let endAngle_rad = (arrowEndAngle - 90 ) * Math.PI / 180 
        let xEnd = r * Math.cos(endAngle_rad)
        let yEnd = r * Math.sin(endAngle_rad)

        let innerPointX = Math.cos(startAngle_rad) * (row * offset)
        let innerPointY = Math.sin(startAngle_rad) * (row * offset)

        let outerPointX = Math.cos(startAngle_rad) * (row * offset + featureThickness)
        let outerPointY = Math.sin(startAngle_rad) * (row * offset + featureThickness) 
        let arrow_info = `${innerPointX},${innerPointY} ${outerPointX},${outerPointY} ${xEnd}, ${yEnd}`
        return arrow_info
    }


    function arrowPointReverse(r, arrowStartAngle, arrowEndAngle) {
        let startAngle_rad = (arrowStartAngle - 90 ) * Math.PI / 180 
        let endAngle_rad = (arrowEndAngle - 90 ) * Math.PI / 180 
        let xEnd = r * Math.cos(startAngle_rad)
        let yEnd = r * Math.sin(startAngle_rad)

        let innerPointX = Math.cos(endAngle_rad) * (row * offset)
        let innerPointY = Math.sin(endAngle_rad) * (row * offset)

        let outerPointX = Math.cos(endAngle_rad) * (row * offset + featureThickness)
        let outerPointY = Math.sin(endAngle_rad) * (row * offset + featureThickness) 
        let arrow_info = `${innerPointX},${innerPointY} ${outerPointX},${outerPointY} ${xEnd}, ${yEnd}`
        return arrow_info
    }

    function featureArrow(row, offset, featureThickness, total, arrowAngleLimit, start, stop, color, reverse, bevelling=10) {
        if (start > total){
            start = total 
        }
        if (stop > total){
            stop = total 
        }
        if (start > stop) {
            let temp = start 
            start = stop 
            stop = temp 
        }
        let startAngle = (start / total) * 360 
        let endAngle = (stop / total) * 360
        let arrowStartAngle = startAngle
        let arrowEndAngle = endAngle
        if (endAngle - startAngle > arrowAngleLimit){
            arrowStartAngle = endAngle - arrowAngleLimit
            if (reverse) {
                arrowStartAngle = startAngle
                arrowEndAngle = startAngle +  arrowAngleLimit
            }
        } 
        // Draw the arrow. 
        let r =  (row * offset) + (featureThickness / 2 )
        let arrow_info = arrowPoint(r, arrowStartAngle, arrowEndAngle)
        if (reverse) {
            arrow_info = arrowPointReverse(r, arrowStartAngle, arrowEndAngle)
        }
        // Finish drawing the arrow. 

        // Create the SVG object 
      //   let payload = `<circle cx=${xEnd} cy=${yEnd} r=2 fill='${color}'/><polyline points="${arrow_info}" fill='${color}'/>`
        let payload = `<polyline points="${arrow_info}" fill='${color}'/>`
        if (endAngle - startAngle > 5) {
            // Need to deal with the arrow being too big.
            // Draw the arc for the remainer of the feature.
            let arcStartAngle_rad = startAngle * Math.PI / 180 
            let arcEndAngle_rad = arrowStartAngle * Math.PI / 180 
            if (reverse) {
                arcStartAngle_rad = arrowEndAngle * Math.PI / 180 
                arcEndAngle_rad = endAngle * Math.PI / 180 
            }
            let featureArc = arc().innerRadius(row * offset).outerRadius(row * offset + featureThickness).startAngle(arcStartAngle_rad).endAngle(arcEndAngle_rad);
            let insidebevel = arc().innerRadius(row * offset).outerRadius(row * offset + (featureThickness / bevelling)).startAngle(arcStartAngle_rad).endAngle(arcEndAngle_rad);
            let outsideBevel = arc().innerRadius(row * offset + (featureThickness - (featureThickness / bevelling))).outerRadius(row * offset + featureThickness).startAngle(arcStartAngle_rad).endAngle(arcEndAngle_rad);
            payload = payload + `<path d=${featureArc()} fill=${color} />`
            payload = payload + `<path d=${outsideBevel()} fill=${shiftColor(color, bevelPercentage)} />`
            payload = payload + `<path d=${insidebevel()} fill=${shiftColor(color, bevelPercentage, true)} />`
        }
        return payload
    }

    function majorTickLabelText(number) {
        number = Math.round(number)
        if (number.toString().length > 4) {
            number = number / 1000
            number = number + " kbp"
        }
        return number
    }
    function innerAxis(total, offsetPadding=1, backboneThickness=1, minorTickLength=5, minorTick=2000, majorTickLength=10, majorTick=10000) { 

        let innerAxis = arc().innerRadius(offset - offsetPadding).outerRadius(offset - offsetPadding - backboneThickness ).startAngle(0).endAngle(360);
        let minorTicks = '' 
        let minorTickDegree = (minorTick / total) * 360 
        for (let i = 0; i < 360; i = i + minorTickDegree) {
            let oneTick = arc().innerRadius(offset - minorTickLength).outerRadius(offset - offsetPadding).startAngle(i * Math.PI / 180 ).endAngle((i + 1) * Math.PI / 180 );
            minorTicks = minorTicks + `<path d=${oneTick()} fill='grey' stroke-linecap='round'/>` 
        }

        let majorTicks = ''
        let majorTickDegree = (majorTick / total) * 360
        for (let i = 0; i < 360; i = i + majorTickDegree) {
            let oneTick = arc().innerRadius(offset - majorTickLength).outerRadius(offset - offsetPadding).startAngle(i * Math.PI / 180 ).endAngle((i + 1) * Math.PI / 180 );
            let oneTickLabel = arc().innerRadius(offset - (majorTickLength * 1.2)).outerRadius(offset - (majorTickLength * 1.2)).startAngle(i * Math.PI / 180 ).endAngle((i + 1) * Math.PI / 180 );
            let align = "left"
            if (i > 160 && i < 200 || (i > 340 || i < 20 )) {
                align = "middle"
            } else if (i < 180) {
                align = "end"
            }
            let labelx = oneTickLabel.centroid()[0]
            let labely = oneTickLabel.centroid()[1]
            if (i != 0) {
                let majorTickLabel = `<text x="${labelx}" y="${labely}" class="small" text-anchor="${align}">${majorTickLabelText(Math.round((i / majorTickDegree) * majorTick))}</text>`
                majorTicks = majorTicks + `<path id=majortick${i} d=${oneTick()} fill='black' stroke-linecap='round'/>` + majorTickLabel
            }
        }
      
        let l = `<line x1=0 y1=0 x2=0 y2=10 stroke='#000000' stroke-width=1 transform='translate(0, -${offset})' />`

        let payload = "<circle cx=0 cy=0 r=4 />"
        payload = payload + `<path d=${innerAxis()} fill='#000000' />`
        payload = payload + minorTicks + majorTicks

     //    payload =  payload + `<path d=${oneTick()} fill='#000000' />`
        return payload

    }

</script>

<h2>Preview</h2>
    <svg {height} {width}>
        <style>
            .small {
              font: 6px sans-serif;
            }
        </style>        
        <g transform='translate({width/2},{height/2})'>
            <!-- Axes -->
            {@html innerAxis(total)}
            <!-- Feature arrow test -->
            {#each demo as feature}
                {@html featureArrow(row, offset, featureThickness, total, arrowAngleLimit, feature.start, feature.stop, feature.color, feature.reverse)}
            {/each}
        </g>
    </svg>

