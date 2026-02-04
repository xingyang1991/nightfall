
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface StarMapProps {
  socialTemp: number;
  stealth: boolean;
}

const StarMap: React.FC<StarMapProps> = ({ socialTemp, stealth }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = window.innerWidth;
    const height = window.innerHeight;

    svg.selectAll("*").remove();

    if (stealth) {
      // Very sparse starfield if stealth is on
      svg.append('rect')
         .attr('width', width)
         .attr('height', height)
         .attr('fill', 'rgba(0,0,0,0.8)');
      return;
    }

    const starCount = 100 + socialTemp * 150;
    const stars = Array.from({ length: starCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.5 + 0.2
    }));

    svg.selectAll('circle')
      .data(stars)
      .enter()
      .append('circle')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', d => d.r)
      .attr('fill', '#fff')
      .attr('opacity', d => d.opacity)
      .each(function(d) {
        d3.select(this)
          .transition()
          .duration(2000 + Math.random() * 3000)
          .attr('opacity', 0.8)
          .transition()
          .duration(2000 + Math.random() * 3000)
          .attr('opacity', 0.2)
          .on('end', function repeat() {
            d3.select(this)
              .transition()
              .duration(2000 + Math.random() * 3000)
              .attr('opacity', 0.8)
              .transition()
              .duration(2000 + Math.random() * 3000)
              .attr('opacity', 0.2)
              .on('end', repeat);
          });
      });

    // Ambient pulses based on social temp
    if (socialTemp > 1) {
      svg.append('circle')
        .attr('cx', width / 2)
        .attr('cy', height / 2)
        .attr('r', 0)
        .attr('fill', 'none')
        .attr('stroke', 'rgba(255,255,255,0.05)')
        .attr('stroke-width', 2)
        .transition()
        .duration(10000)
        .attr('r', width * 0.8)
        .style('opacity', 0)
        .remove();
    }

  }, [socialTemp, stealth]);

  return <svg ref={svgRef} className="fixed inset-0 w-full h-full pointer-events-none opacity-40" />;
};

export default StarMap;
